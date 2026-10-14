package com.gate21.placement;

import com.gate21.common.ApiException;
import com.gate21.common.Db;
import com.gate21.content.ContentModels.Band;
import com.gate21.content.ContentModels.Placement;
import com.gate21.content.ContentService;
import com.gate21.progress.ProgressRepository;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scores the 2-minute travel check. The written part is worth up to 60 points, the speaking
 * part up to 30 and everyone starts at 10. Without speaking scores (no microphone consent)
 * the written result stands in for the speaking part.
 */
@Service
public class PlacementService {

    public enum Kind { INITIAL, FINAL }

    public record Result(int score, int correct, int total, String level, int startDay, String messageTr,
                         boolean startDayApplied) {
    }

    private final ContentService content;
    private final ProgressRepository progress;
    private final JdbcClient jdbc;
    private final Clock clock;

    public PlacementService(ContentService content, ProgressRepository progress, JdbcClient jdbc, Clock clock) {
        this.content = content;
        this.progress = progress;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public Result submit(UUID userId, Kind kind, List<Integer> answers, List<Integer> speakingScores) {
        Placement placement = content.placement();
        int total = placement.questions().size();
        if (answers.size() != total) {
            throw ApiException.badRequest("WRONG_ANSWER_COUNT", "Expected " + total + " answers");
        }
        int correct = 0;
        for (int i = 0; i < total; i++) {
            Integer answer = answers.get(i);
            if (answer != null && answer == placement.questions().get(i).answer()) {
                correct++;
            }
        }
        int written = Math.round(60f * correct / total);
        int speaking = speakingScores == null || speakingScores.isEmpty()
            ? written / 2
            : Math.round(0.3f * (float) speakingScores.stream().mapToInt(s -> Math.max(0, Math.min(100, s))).average().orElse(0));
        int score = Math.min(100, 10 + written + speaking);
        Band band = bandFor(placement.bands(), score);

        progress.lockStats(userId);
        boolean applied = false;
        if (kind == Kind.INITIAL) {
            // The starting day can only be chosen before the journey begins.
            applied = !progress.hasAnyActivity(userId);
            progress.setPlacement(userId, score, applied ? band.startDay() : null);
        } else {
            progress.setFinalScore(userId, score);
        }
        jdbc.sql("""
                INSERT INTO placement_results (id, user_id, kind, score, level, created_at)
                VALUES (:id, :userId, :kind, :score, :level, :now)
                """)
            .param("id", UUID.randomUUID())
            .param("userId", userId)
            .param("kind", kind.name())
            .param("score", score)
            .param("level", band.level())
            .param("now", Db.ts(clock.instant()))
            .update();
        return new Result(score, correct, total, band.level(), band.startDay(), band.messageTr(), applied);
    }

    static Band bandFor(List<Band> bands, int score) {
        Band match = bands.getFirst();
        for (Band band : bands) {
            if (score >= band.min()) {
                match = band;
            }
        }
        return match;
    }
}
