package com.gate21.roleplay;

import com.gate21.common.ApiException;
import com.gate21.common.QuotaService;
import com.gate21.config.AppProperties;
import com.gate21.content.ContentModels.Goal;
import com.gate21.content.ContentModels.Option;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentService;
import com.gate21.roleplay.RoleplayModel.Context;
import com.gate21.roleplay.RoleplayModel.Reply;
import com.gate21.roleplay.RoleplayModel.Turn;
import com.gate21.roleplay.RoleplayRepository.SessionRow;
import com.gate21.speech.SpeechService;
import com.gate21.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs a scene as a state machine over the scenario's goals. The model (Gemini) phrases replies
 * and judges the current goal; which goal is current, and when the twist arrives, is decided here.
 * No transaction or row lock is held while the model is thinking.
 */
@Service
public class RoleplayService {

    private static final Logger log = LoggerFactory.getLogger(RoleplayService.class);

    public record SceneView(UUID sessionId, String scenario, String title, String titleTr, String role, String setting,
                            String userText, String reply, Boolean goalMet, String feedbackTr, boolean twist,
                            int goalIndex, int totalGoals, String hint, List<String> hintOptions, boolean done,
                            boolean completed, String model) {
    }

    private final RoleplayRepository repo;
    private final RoleplayModel model;
    private final RoleplayModel fallback = new ScriptedRoleplayModel();
    private final ContentService content;
    private final UserRepository users;
    private final SpeechService speech;
    private final QuotaService quota;
    private final AppProperties props;
    private final TransactionTemplate tx;
    private final Clock clock;

    public RoleplayService(RoleplayRepository repo, RoleplayModel model, ContentService content, UserRepository users,
                           SpeechService speech, QuotaService quota, AppProperties props, TransactionTemplate tx,
                           Clock clock) {
        this.repo = repo;
        this.model = model;
        this.content = content;
        this.users = users;
        this.speech = speech;
        this.quota = quota;
        this.props = props;
        this.tx = tx;
        this.clock = clock;
    }

    public SceneView start(UUID userId, String scenarioSlug) {
        Scenario scenario = content.scenario(scenarioSlug)
            .orElseThrow(() -> ApiException.notFound("SCENARIO_NOT_FOUND", "No scenario " + scenarioSlug));
        String guestName = guestName(userId);
        UUID sessionId = UUID.randomUUID();
        Instant now = clock.instant();
        tx.executeWithoutResult(status -> {
            quota.consume(userId, QuotaService.ROLEPLAY, props.quota().roleplaySessionsPerDay(), "ROLEPLAY_QUOTA_EXCEEDED");
            repo.insertSession(sessionId, userId, scenario.slug(), now);
            repo.insertTurn(sessionId, 0, "AI", scenario.opening(), null, now);
        });
        return view(sessionId, scenario, null, scenario.opening(), null, null, false, 0, false, false, guestName, "script");
    }

    public SceneView turn(UUID userId, UUID sessionId, String text, byte[] audio) {
        SessionRow session = repo.findSession(sessionId, userId)
            .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "No such session"));
        if (!"ACTIVE".equals(session.status())) {
            throw ApiException.conflict("SESSION_FINISHED", "This scene is already over.");
        }
        Scenario scenario = content.scenario(session.scenarioSlug()).orElseThrow();
        String guestName = guestName(userId);
        String userText = userText(userId, text, audio);
        List<Turn> history = repo.turns(sessionId);

        Context ctx = new Context(scenario, session.goalIndex(), history, userText, guestName);
        Reply reply;
        String usedModel = model.name();
        try {
            reply = model.respond(ctx);
        } catch (RuntimeException e) {
            log.warn("Role-play model {} failed, using the scripted fallback: {}", model.name(), e.getMessage());
            reply = fallback.respond(ctx);
            usedModel = fallback.name();
        }

        int goals = scenario.goals().size();
        int nextGoal = reply.goalMet() ? session.goalIndex() + 1 : session.goalIndex();
        int turns = session.turnCount() + 1;
        boolean completed = nextGoal >= goals;
        boolean done = completed || turns >= props.quota().roleplayMaxTurns();
        String status = completed ? "COMPLETED" : (done ? "ABANDONED" : "ACTIVE");
        boolean twist = reply.goalMet() && !completed && scenario.goals().get(nextGoal).twist();
        Instant now = clock.instant();
        Reply r = reply;

        tx.executeWithoutResult(s -> {
            if (!repo.advance(sessionId, session.turnCount(), nextGoal, turns, status, now)) {
                throw ApiException.conflict("TURN_CONFLICT", "This turn was already sent.");
            }
            int seq = history.size();
            repo.insertTurn(sessionId, seq, "USER", userText, r.goalMet(), now);
            repo.insertTurn(sessionId, seq + 1, "AI", r.reply(), null, now);
        });

        return view(sessionId, scenario, userText, r.reply(), r.goalMet(), r.feedbackTr(), twist,
            Math.min(nextGoal, goals), done, completed, guestName, usedModel);
    }

    private String userText(UUID userId, String text, byte[] audio) {
        String result = null;
        if (audio != null && audio.length > 0) {
            String transcript = speech.transcribe(userId, audio);
            if (transcript != null) {
                if (transcript.isBlank()) {
                    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SPEECH_NOT_RECOGNIZED",
                        "We couldn't hear you clearly. Try again.");
                }
                result = transcript;
            }
        }
        if (result == null) {
            result = text;
        }
        if (result == null || result.isBlank()) {
            throw ApiException.badRequest("TEXT_REQUIRED", "Say or type something first.");
        }
        result = result.strip();
        return result.length() > GeminiRoleplayModel.MAX_USER_CHARS
            ? result.substring(0, GeminiRoleplayModel.MAX_USER_CHARS)
            : result;
    }

    private String guestName(UUID userId) {
        return users.findById(userId).map(u -> u.displayName()).orElse("Guest");
    }

    private SceneView view(UUID sessionId, Scenario scenario, String userText, String reply, Boolean goalMet,
                           String feedbackTr, boolean twist, int goalIndex, boolean done, boolean completed,
                           String guestName, String usedModel) {
        String hint = null;
        List<String> options = List.of();
        if (!done && goalIndex < scenario.goals().size()) {
            Goal goal = scenario.goals().get(goalIndex);
            if (goal.twist()) {
                options = goal.options().stream().map(Option::text).toList();
            } else {
                hint = goal.hint().replace("{name}", guestName);
            }
        }
        return new SceneView(sessionId, scenario.slug(), scenario.title(), scenario.titleTr(), scenario.role(),
            scenario.setting(), userText, reply, goalMet, feedbackTr, twist, goalIndex, scenario.goals().size(), hint,
            options, done, completed, usedModel);
    }
}
