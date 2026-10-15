package com.gate21.roleplay;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.common.ApiException;
import com.gate21.common.QuotaService;
import com.gate21.config.AppProperties;
import com.gate21.membership.MembershipService;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.Fact;
import com.gate21.content.ContentModels.Option;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentService;
import com.gate21.roleplay.RoleplayModel.Context;
import com.gate21.roleplay.RoleplayModel.Phrase;
import com.gate21.roleplay.RoleplayModel.Reply;
import com.gate21.roleplay.RoleplayModel.Review;
import com.gate21.roleplay.RoleplayModel.ReviewContext;
import com.gate21.roleplay.RoleplayModel.ReviewLine;
import com.gate21.roleplay.RoleplayModel.Turn;
import com.gate21.roleplay.RoleplayModel.UserLine;
import com.gate21.roleplay.RoleplayRepository.SessionRow;
import com.gate21.roleplay.RoleplayRepository.TurnRow;
import com.gate21.speech.SpeechService;
import com.gate21.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs a scene as a state machine over a per-session plan of goals and surprises. The model
 * phrases replies and judges the current step; which step is current, when a surprise lands
 * and when a new character takes over is decided here. No transaction or row lock is held
 * while the model is thinking.
 */
@Service
public class RoleplayService {

    private static final Logger log = LoggerFactory.getLogger(RoleplayService.class);

    /** One character line. kind: say | twist | transition | closing. */
    public record Message(String kind, String role, String text, String voice) {
    }

    public record SceneView(UUID sessionId, String scenario, String title, String titleTr, String difficulty,
                            String briefTr, String role, String setting, String voice, String userText,
                            Boolean goalMet, String feedbackTr, boolean twist, List<Message> messages, int stepIndex,
                            int totalSteps, String stepTitleTr, boolean hintsAllowed, String hint, String hintTr,
                            List<String> hintOptions, boolean done, boolean completed, String model) {
    }

    public record MemoryQuestion(String question, String questionTr, List<String> options, int answer) {
    }

    public record Report(UUID sessionId, String title, boolean completed, int score, int failedTurns, int hintsUsed,
                         List<ReviewLine> lines, String hardestTr, List<Phrase> phrases,
                         List<MemoryQuestion> memory, String model) {
    }

    private final RoleplayRepository repo;
    private final RoleplayModel model;
    private final RoleplayModel fallback = new ScriptedRoleplayModel();
    private final ContentService content;
    private final UserRepository users;
    private final MembershipService membership;
    private final SpeechService speech;
    private final QuotaService quota;
    private final AppProperties props;
    private final TransactionTemplate tx;
    private final ObjectMapper mapper;
    private final RandomGenerator random;
    private final Clock clock;

    public RoleplayService(RoleplayRepository repo, RoleplayModel model, ContentService content, UserRepository users,
                           MembershipService membership, SpeechService speech, QuotaService quota, AppProperties props,
                           TransactionTemplate tx, ObjectMapper mapper, RandomGenerator sceneRandom, Clock clock) {
        this.repo = repo;
        this.model = model;
        this.content = content;
        this.users = users;
        this.membership = membership;
        this.speech = speech;
        this.quota = quota;
        this.props = props;
        this.tx = tx;
        this.mapper = mapper;
        this.random = sceneRandom;
        this.clock = clock;
    }

    // ---- start -------------------------------------------------------------------------------

    public SceneView start(UUID userId, String scenarioSlug) {
        Scenario scenario = content.scenario(scenarioSlug)
            .orElseThrow(() -> ApiException.notFound("SCENARIO_NOT_FOUND", "No scenario " + scenarioSlug));
        ChapterInfo chapter = content.chapterInfo(scenario.chapter()).orElseThrow();
        membership.requirePlay(userId, chapter);
        String guestName = guestName(userId);
        Difficulty difficulty = Difficulty.forWeek(chapter.week());
        List<String> plan = ScenePlanner.plan(scenario, difficulty, random);
        Map<String, String> facts = ScenePlanner.facts(scenario, random);
        List<SceneStep> steps = ScenePlanner.resolve(scenario, plan, facts, guestName);
        SceneStep first = steps.getFirst();
        Map<String, String> values = new java.util.LinkedHashMap<>(facts);
        values.put("name", guestName);
        String opening = ScenePlanner.fill(scenario.opening(), values);

        UUID sessionId = UUID.randomUUID();
        Instant now = clock.instant();
        tx.executeWithoutResult(status -> {
            quota.consume(userId, QuotaService.ROLEPLAY, props.quota().roleplaySessionsPerDay(), "ROLEPLAY_QUOTA_EXCEEDED");
            repo.insertSession(sessionId, userId, scenario.slug(), difficulty.name(), json(plan), json(facts), now);
            repo.insertTurn(sessionId, 0, "AI", "say", opening, first.id(), null, now);
        });
        List<Message> messages = List.of(new Message("say", first.role(), opening, first.voice()));
        return view(sessionId, scenario, values, difficulty, steps, 0, null, null, null, messages, false, false, "script");
    }

    // ---- one turn ----------------------------------------------------------------------------

    public SceneView turn(UUID userId, UUID sessionId, String text, byte[] audio, boolean hintUsed) {
        SessionRow session = repo.findSession(sessionId, userId)
            .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "No such session"));
        if (!"ACTIVE".equals(session.status())) {
            throw ApiException.conflict("SESSION_FINISHED", "This scene is already over.");
        }
        Scenario scenario = content.scenario(session.scenarioSlug()).orElseThrow();
        Difficulty difficulty = Difficulty.valueOf(session.difficulty());
        String guestName = guestName(userId);
        Map<String, String> facts = readFacts(session.factsJson());
        List<SceneStep> steps = ScenePlanner.resolve(scenario, readPlan(session.planJson()), facts, guestName);
        SceneStep step = steps.get(session.stepIndex());
        String userText = userText(userId, text, audio);
        List<TurnRow> stored = repo.turns(sessionId);

        Context ctx = new Context(step, conversation(stored), userText, guestName);
        Reply reply;
        String usedModel = model.name();
        try {
            reply = model.respond(ctx);
        } catch (RuntimeException e) {
            log.warn("Role-play model {} failed, using the scripted fallback: {}", model.name(), e.getMessage());
            reply = fallback.respond(ctx);
            usedModel = fallback.name();
        }

        List<Message> messages = new ArrayList<>();
        messages.add(new Message("say", step.role(), reply.reply(), step.voice()));
        int nextIndex = reply.goalMet() ? session.stepIndex() + 1 : session.stepIndex();
        boolean completed = nextIndex >= steps.size();
        if (reply.goalMet()) {
            messages.addAll(lead(steps, nextIndex, step, scenario, facts, guestName));
        }

        int turns = session.turnCount() + 1;
        boolean done = completed || turns >= maxTurns(steps);
        String status = completed ? "COMPLETED" : (done ? "ABANDONED" : "ACTIVE");
        Instant now = clock.instant();
        Reply r = reply;
        String stepId = step.id();

        tx.executeWithoutResult(s -> {
            if (!repo.advance(sessionId, session.turnCount(), nextIndex, turns, status, hintUsed ? 1 : 0,
                r.goalMet() ? 0 : 1, now)) {
                throw ApiException.conflict("TURN_CONFLICT", "This turn was already sent.");
            }
            int seq = stored.size();
            repo.insertTurn(sessionId, seq++, "USER", "user", userText, stepId, r.goalMet(), now);
            for (Message m : messages) {
                repo.insertTurn(sessionId, seq++, "AI", m.kind(), m.text(), stepId, null, now);
            }
        });

        Map<String, String> values = new java.util.LinkedHashMap<>(facts);
        values.put("name", guestName);
        return view(sessionId, scenario, values, difficulty, steps, Math.min(nextIndex, steps.size()), userText,
            r.goalMet(), r.feedbackTr(), messages, done, completed, usedModel);
    }

    /**
     * What the character says after a step is met: the surprise's intro, a scene change to a new
     * character, the next question, or the closing line when the scene is over.
     */
    static List<Message> lead(List<SceneStep> steps, int nextIndex, SceneStep current, Scenario scenario,
                              Map<String, String> facts, String guestName) {
        List<Message> out = new ArrayList<>();
        if (nextIndex >= steps.size()) {
            if (scenario.closing() != null) {
                Map<String, String> values = new java.util.LinkedHashMap<>(facts);
                values.put("name", guestName);
                out.add(new Message("closing", current.role(), ScenePlanner.fill(scenario.closing(), values), current.voice()));
            }
            return out;
        }
        SceneStep next = steps.get(nextIndex);
        if (next.twist()) {
            out.add(new Message("twist", next.role(), next.ask(), next.voice()));
        } else if (next.segmentStart()) {
            out.add(new Message("transition", next.role(), next.setting(), next.voice()));
            out.add(new Message("say", next.role(), next.ask(), next.voice()));
        } else if (next.ask() != null) {
            out.add(new Message("say", next.role(), next.ask(), next.voice()));
        }
        return out;
    }

    /** Room for every step plus a retry on each, and a little slack. */
    static int maxTurns(List<SceneStep> steps) {
        return steps.size() * 2 + 2;
    }

    // ---- report ------------------------------------------------------------------------------

    public Report report(UUID userId, UUID sessionId) {
        SessionRow session = repo.findSession(sessionId, userId)
            .orElseThrow(() -> ApiException.notFound("SESSION_NOT_FOUND", "No such session"));
        if ("ACTIVE".equals(session.status())) {
            throw ApiException.conflict("SESSION_ACTIVE", "Finish the scene first.");
        }
        if (session.reportJson() != null) {
            return readJson(session.reportJson(), Report.class);
        }

        Scenario scenario = content.scenario(session.scenarioSlug()).orElseThrow();
        String guestName = guestName(userId);
        Map<String, String> facts = readFacts(session.factsJson());
        List<SceneStep> steps = ScenePlanner.resolve(scenario, readPlan(session.planJson()), facts, guestName);
        List<TurnRow> stored = repo.turns(sessionId);
        List<UserLine> userLines = stored.stream()
            .filter(t -> "USER".equals(t.role()))
            .map(t -> new UserLine(t.text(), t.stepId(), Boolean.TRUE.equals(t.goalMet())))
            .toList();
        ReviewContext ctx = new ReviewContext(scenario.title(), conversation(stored), userLines, steps);

        Review review;
        String usedModel = model.name();
        try {
            review = model.review(ctx);
        } catch (RuntimeException e) {
            log.warn("Review by {} failed, using the scripted fallback: {}", model.name(), e.getMessage());
            review = fallback.review(ctx);
            usedModel = fallback.name();
        }

        boolean completed = "COMPLETED".equals(session.status());
        Report report = new Report(sessionId, scenario.title(), completed,
            score(session.failedTurns(), session.hintsUsed()), session.failedTurns(), session.hintsUsed(),
            review.lines(), review.hardestTr(), review.phrases(),
            memory(scenario, facts, stored, sessionId), usedModel);
        repo.saveReport(sessionId, json(report));
        return report;
    }

    /** 100 for a clean run; each retry costs 15 and each hint 10, never below 40. */
    static int score(int failedTurns, int hintsUsed) {
        return Math.max(40, 100 - 15 * failedTurns - 10 * hintsUsed);
    }

    /**
     * Multiple-choice questions about facts the characters actually said (room number, gate…),
     * with the real value and two others from the same list.
     */
    static List<MemoryQuestion> memory(Scenario scenario, Map<String, String> facts, List<TurnRow> stored, UUID sessionId) {
        Random shuffle = new Random(sessionId.getMostSignificantBits());
        List<MemoryQuestion> questions = new ArrayList<>();
        for (Fact fact : scenario.facts()) {
            String value = facts.get(fact.id());
            boolean mentioned = value != null && stored.stream()
                .anyMatch(t -> "AI".equals(t.role()) && t.text().contains(value));
            if (!mentioned) {
                continue;
            }
            List<String> others = new ArrayList<>(fact.values());
            others.remove(value);
            Collections.shuffle(others, shuffle);
            List<String> options = new ArrayList<>(others.subList(0, Math.min(2, others.size())));
            options.add(value);
            Collections.shuffle(options, shuffle);
            questions.add(new MemoryQuestion(fact.question(), fact.questionTr(), options, options.indexOf(value)));
        }
        return questions;
    }

    // ---- helpers -----------------------------------------------------------------------------

    private SceneView view(UUID sessionId, Scenario scenario, Map<String, String> values, Difficulty difficulty,
                           List<SceneStep> steps, int stepIndex, String userText, Boolean goalMet, String feedbackTr,
                           List<Message> messages, boolean done, boolean completed, String usedModel) {
        SceneStep current = stepIndex < steps.size() ? steps.get(stepIndex) : steps.getLast();
        String hint = null;
        String hintTr = null;
        List<String> options = List.of();
        if (!done && difficulty.hintsAllowed()) {
            if (current.twist()) {
                options = current.options().stream().map(Option::text).toList();
            } else {
                hint = current.hint();
                hintTr = current.hintTr();
            }
        }
        boolean twist = messages.stream().anyMatch(m -> "twist".equals(m.kind()));
        return new SceneView(sessionId, scenario.slug(), scenario.title(), scenario.titleTr(), difficulty.name(),
            ScenePlanner.fill(scenario.briefTr(), values), current.role(), current.setting(), current.voice(), userText,
            goalMet, feedbackTr, twist, messages, stepIndex, steps.size(), current.titleTr(),
            difficulty.hintsAllowed(), hint, hintTr, options, done, completed, usedModel);
    }

    /** Stored lines as the model sees them: scene changes are stage directions, not dialogue. */
    private static List<Turn> conversation(List<TurnRow> stored) {
        return stored.stream()
            .filter(t -> !"transition".equals(t.kind()))
            .map(t -> new Turn(t.role(), t.text()))
            .toList();
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

    private List<String> readPlan(String json) {
        return readType(json, new TypeReference<List<String>>() { });
    }

    private Map<String, String> readFacts(String json) {
        return readType(json, new TypeReference<Map<String, String>>() { });
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private <T> T readJson(String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private <T> T readType(String json, TypeReference<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
