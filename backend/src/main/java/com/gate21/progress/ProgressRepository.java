package com.gate21.progress;

import com.gate21.common.Db;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ProgressRepository {

    public record StatsRow(UUID userId, int xpTotal, int streakCurrent, int streakBest, LocalDate lastActiveDate,
                           int startDay, Integer placementScore, Integer finalScore, int speakingSum,
                           int speakingCount) {

        public Integer speakingAverage() {
            return speakingCount == 0 ? null : Math.round((float) speakingSum / speakingCount);
        }
    }

    public record ChapterRow(String chapterSlug, int stepsDone, int scoreSum, int scoreCount, int stars,
                             Instant stampedAt) {

        public Integer averageScore() {
            return scoreCount == 0 ? null : Math.round((float) scoreSum / scoreCount);
        }

        public boolean complete(int requiredBits) {
            return (stepsDone & requiredBits) == requiredBits;
        }
    }

    private final JdbcClient jdbc;

    public ProgressRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---- user_stats -------------------------------------------------------------------------

    public Optional<StatsRow> stats(UUID userId) {
        return jdbc.sql("SELECT * FROM user_stats WHERE user_id = :userId")
            .param("userId", userId)
            .query(ProgressRepository::mapStats)
            .optional();
    }

    /** Row lock that serializes every progress write of one user (two devices syncing at once). */
    public StatsRow lockStats(UUID userId) {
        return jdbc.sql("SELECT * FROM user_stats WHERE user_id = :userId FOR UPDATE")
            .param("userId", userId)
            .query(ProgressRepository::mapStats)
            .single();
    }

    public void saveStats(UUID userId, int xpGained, int streak, int streakBest, LocalDate lastActive,
                          int speakingSumAdd, int speakingCountAdd) {
        jdbc.sql("""
                UPDATE user_stats
                SET xp_total = xp_total + :xp,
                    streak_current = :streak,
                    streak_best = :best,
                    last_active_date = :lastActive,
                    speaking_sum = speaking_sum + :sSum,
                    speaking_count = speaking_count + :sCount
                WHERE user_id = :userId
                """)
            .param("xp", xpGained)
            .param("streak", streak)
            .param("best", streakBest)
            .param("lastActive", lastActive, Types.DATE)
            .param("sSum", speakingSumAdd)
            .param("sCount", speakingCountAdd)
            .param("userId", userId)
            .update();
    }

    public void setPlacement(UUID userId, int score, Integer startDay) {
        jdbc.sql("""
                UPDATE user_stats
                SET placement_score = :score, start_day = COALESCE(:startDay, start_day)
                WHERE user_id = :userId
                """)
            .param("score", score)
            .param("startDay", startDay, Types.SMALLINT)
            .param("userId", userId)
            .update();
    }

    public void setFinalScore(UUID userId, int score) {
        jdbc.sql("UPDATE user_stats SET final_score = :score WHERE user_id = :userId")
            .param("score", score)
            .param("userId", userId)
            .update();
    }

    // ---- attempts ---------------------------------------------------------------------------

    /** Idempotent on (user_id, client_id): a retried sync never awards XP twice. */
    public boolean insertAttempt(UUID userId, UUID clientId, String chapterSlug, Step step, Integer score,
                                 int xp, Instant occurredAt, Instant now) {
        return jdbc.sql("""
                INSERT INTO attempts (id, user_id, client_id, chapter_slug, step, score, xp_awarded, occurred_at, created_at)
                VALUES (:id, :userId, :clientId, :chapter, :step, :score, :xp, :occurredAt, :now)
                ON CONFLICT (user_id, client_id) DO NOTHING
                """)
            .param("id", UUID.randomUUID())
            .param("userId", userId)
            .param("clientId", clientId)
            .param("chapter", chapterSlug)
            .param("step", step.name())
            .param("score", score, Types.SMALLINT)
            .param("xp", xp)
            .param("occurredAt", Db.ts(occurredAt))
            .param("now", Db.ts(now))
            .update() == 1;
    }

    // ---- daily_activity ---------------------------------------------------------------------

    public void addDailyXp(UUID userId, LocalDate day, int xp) {
        jdbc.sql("""
                INSERT INTO daily_activity (user_id, local_date, xp) VALUES (:userId, :day, :xp)
                ON CONFLICT (user_id, local_date) DO UPDATE SET xp = daily_activity.xp + EXCLUDED.xp
                """)
            .param("userId", userId)
            .param("day", day)
            .param("xp", xp)
            .update();
    }

    public List<LocalDate> activeDaysNewestFirst(UUID userId, int limit) {
        return jdbc.sql("""
                SELECT local_date FROM daily_activity
                WHERE user_id = :userId AND xp >= :goal
                ORDER BY local_date DESC
                LIMIT :limit
                """)
            .param("userId", userId)
            .param("goal", ProgressRules.DAILY_GOAL_XP)
            .param("limit", limit)
            .query((rs, n) -> rs.getObject("local_date", LocalDate.class))
            .list();
    }

    public int activeDaysBefore(UUID userId, LocalDate day) {
        return jdbc.sql("""
                SELECT count(*) FROM daily_activity
                WHERE user_id = :userId AND local_date < :day AND xp >= :goal
                """)
            .param("userId", userId)
            .param("day", day)
            .param("goal", ProgressRules.DAILY_GOAL_XP)
            .query(Integer.class)
            .single();
    }

    public int xpOn(UUID userId, LocalDate day) {
        return jdbc.sql("SELECT xp FROM daily_activity WHERE user_id = :userId AND local_date = :day")
            .param("userId", userId)
            .param("day", day)
            .query(Integer.class)
            .optional()
            .orElse(0);
    }

    public boolean hasAnyActivity(UUID userId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM daily_activity WHERE user_id = :userId)")
            .param("userId", userId)
            .query(Boolean.class)
            .single();
    }

    // ---- chapter_progress -------------------------------------------------------------------

    public void applyStep(UUID userId, String chapterSlug, Step step, Integer score) {
        jdbc.sql("""
                INSERT INTO chapter_progress (user_id, chapter_slug, steps_done, score_sum, score_count)
                VALUES (:userId, :chapter, :bit, :sum, :count)
                ON CONFLICT (user_id, chapter_slug) DO UPDATE SET
                    steps_done = chapter_progress.steps_done | EXCLUDED.steps_done,
                    score_sum = chapter_progress.score_sum + EXCLUDED.score_sum,
                    score_count = chapter_progress.score_count + EXCLUDED.score_count
                """)
            .param("userId", userId)
            .param("chapter", chapterSlug)
            .param("bit", step.bit())
            .param("sum", score == null ? 0 : score)
            .param("count", score == null ? 0 : 1)
            .update();
    }

    public List<ChapterRow> chapters(UUID userId) {
        return jdbc.sql("SELECT * FROM chapter_progress WHERE user_id = :userId")
            .param("userId", userId)
            .query((rs, n) -> new ChapterRow(
                rs.getString("chapter_slug"),
                rs.getInt("steps_done"),
                rs.getInt("score_sum"),
                rs.getInt("score_count"),
                rs.getInt("stars"),
                Db.instant(rs, "stamped_at")))
            .list();
    }

    public void stamp(UUID userId, String chapterSlug, int stars, Instant now) {
        jdbc.sql("""
                UPDATE chapter_progress
                SET stars = GREATEST(stars, :stars), stamped_at = COALESCE(stamped_at, :now)
                WHERE user_id = :userId AND chapter_slug = :chapter
                """)
            .param("stars", stars)
            .param("now", Db.ts(now))
            .param("userId", userId)
            .param("chapter", chapterSlug)
            .update();
    }

    private static StatsRow mapStats(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new StatsRow(
            rs.getObject("user_id", UUID.class),
            rs.getInt("xp_total"),
            rs.getInt("streak_current"),
            rs.getInt("streak_best"),
            rs.getObject("last_active_date", LocalDate.class),
            rs.getInt("start_day"),
            Db.nullableInt(rs, "placement_score"),
            Db.nullableInt(rs, "final_score"),
            rs.getInt("speaking_sum"),
            rs.getInt("speaking_count"));
    }
}
