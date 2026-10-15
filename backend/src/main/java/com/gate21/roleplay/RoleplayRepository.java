package com.gate21.roleplay;

import com.gate21.common.Db;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RoleplayRepository {

    public record SessionRow(UUID id, UUID userId, String scenarioSlug, int stepIndex, int turnCount, String status,
                             String difficulty, String planJson, String factsJson, int hintsUsed, int failedTurns,
                             String reportJson) {
    }

    /** A stored line. kind: say | twist | transition | closing for the character, user for the learner. */
    public record TurnRow(int seq, String role, String kind, String text, String stepId, Boolean goalMet) {
    }

    private final JdbcClient jdbc;

    public RoleplayRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insertSession(UUID id, UUID userId, String scenarioSlug, String difficulty, String planJson,
                              String factsJson, Instant now) {
        jdbc.sql("""
                INSERT INTO roleplay_sessions
                    (id, user_id, scenario_slug, goal_index, turn_count, status, difficulty, plan, facts, created_at, updated_at)
                VALUES (:id, :userId, :scenario, 0, 0, 'ACTIVE', :difficulty, :plan, :facts, :now, :now)
                """)
            .param("id", id)
            .param("userId", userId)
            .param("scenario", scenarioSlug)
            .param("difficulty", difficulty)
            .param("plan", planJson)
            .param("facts", factsJson)
            .param("now", Db.ts(now))
            .update();
    }

    public Optional<SessionRow> findSession(UUID id, UUID userId) {
        return jdbc.sql("SELECT * FROM roleplay_sessions WHERE id = :id AND user_id = :userId")
            .param("id", id)
            .param("userId", userId)
            .query((rs, n) -> new SessionRow(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("scenario_slug"),
                rs.getInt("goal_index"),
                rs.getInt("turn_count"),
                rs.getString("status"),
                rs.getString("difficulty"),
                rs.getString("plan"),
                rs.getString("facts"),
                rs.getInt("hints_used"),
                rs.getInt("failed_turns"),
                rs.getString("report")))
            .optional();
    }

    /**
     * Optimistic concurrency: the update only applies if nobody else advanced the session since
     * it was read. Returns false on a lost race, e.g. a double-tapped send button.
     */
    public boolean advance(UUID id, int expectedTurnCount, int stepIndex, int turnCount, String status,
                           int hintsAdd, int failedAdd, Instant now) {
        return jdbc.sql("""
                UPDATE roleplay_sessions
                SET goal_index = :step, turn_count = :turns, status = :status,
                    hints_used = hints_used + :hints, failed_turns = failed_turns + :failed, updated_at = :now
                WHERE id = :id AND turn_count = :expected AND status = 'ACTIVE'
                """)
            .param("step", stepIndex)
            .param("turns", turnCount)
            .param("status", status)
            .param("hints", hintsAdd)
            .param("failed", failedAdd)
            .param("now", Db.ts(now))
            .param("id", id)
            .param("expected", expectedTurnCount)
            .update() == 1;
    }

    /** Stores the report once; a second, concurrent generation keeps the first. */
    /** The newest saved scene reports of a user, as stored JSON. */
    public List<String> recentReports(UUID userId, int limit) {
        return jdbc.sql("""
                SELECT report FROM roleplay_sessions
                WHERE user_id = :userId AND report IS NOT NULL
                ORDER BY updated_at DESC
                LIMIT :limit
                """)
            .param("userId", userId)
            .param("limit", limit)
            .query(String.class)
            .list();
    }

    public void saveReport(UUID id, String reportJson) {
        jdbc.sql("UPDATE roleplay_sessions SET report = :report WHERE id = :id AND report IS NULL")
            .param("report", reportJson)
            .param("id", id)
            .update();
    }

    public void insertTurn(UUID sessionId, int seq, String role, String kind, String text, String stepId,
                           Boolean goalMet, Instant now) {
        jdbc.sql("""
                INSERT INTO roleplay_turns (id, session_id, seq, role, kind, text, step_id, goal_met, created_at)
                VALUES (:id, :sessionId, :seq, :role, :kind, :text, :stepId, :goalMet, :now)
                """)
            .param("id", UUID.randomUUID())
            .param("sessionId", sessionId)
            .param("seq", seq)
            .param("role", role)
            .param("kind", kind)
            .param("text", text.length() > 600 ? text.substring(0, 600) : text)
            .param("stepId", stepId, Types.VARCHAR)
            .param("goalMet", goalMet, Types.BOOLEAN)
            .param("now", Db.ts(now))
            .update();
    }

    public List<TurnRow> turns(UUID sessionId) {
        return jdbc.sql("SELECT seq, role, kind, text, step_id, goal_met FROM roleplay_turns WHERE session_id = :id ORDER BY seq")
            .param("id", sessionId)
            .query((rs, n) -> new TurnRow(rs.getInt("seq"), rs.getString("role"), rs.getString("kind"),
                rs.getString("text"), rs.getString("step_id"), rs.getObject("goal_met", Boolean.class)))
            .list();
    }
}
