package com.gate21.roleplay;

import com.gate21.common.Db;
import com.gate21.roleplay.RoleplayModel.Turn;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RoleplayRepository {

    public record SessionRow(UUID id, UUID userId, String scenarioSlug, int goalIndex, int turnCount, String status) {
    }

    private final JdbcClient jdbc;

    public RoleplayRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insertSession(UUID id, UUID userId, String scenarioSlug, Instant now) {
        jdbc.sql("""
                INSERT INTO roleplay_sessions (id, user_id, scenario_slug, goal_index, turn_count, status, created_at, updated_at)
                VALUES (:id, :userId, :scenario, 0, 0, 'ACTIVE', :now, :now)
                """)
            .param("id", id)
            .param("userId", userId)
            .param("scenario", scenarioSlug)
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
                rs.getString("status")))
            .optional();
    }

    /**
     * Optimistic concurrency: the update only applies if nobody else advanced the session since
     * it was read. Returns false on a lost race, e.g. a double-tapped send button.
     */
    public boolean advance(UUID id, int expectedTurnCount, int goalIndex, int turnCount, String status, Instant now) {
        return jdbc.sql("""
                UPDATE roleplay_sessions
                SET goal_index = :goal, turn_count = :turns, status = :status, updated_at = :now
                WHERE id = :id AND turn_count = :expected AND status = 'ACTIVE'
                """)
            .param("goal", goalIndex)
            .param("turns", turnCount)
            .param("status", status)
            .param("now", Db.ts(now))
            .param("id", id)
            .param("expected", expectedTurnCount)
            .update() == 1;
    }

    public void insertTurn(UUID sessionId, int seq, String role, String text, Boolean goalMet, Instant now) {
        jdbc.sql("""
                INSERT INTO roleplay_turns (id, session_id, seq, role, text, goal_met, created_at)
                VALUES (:id, :sessionId, :seq, :role, :text, :goalMet, :now)
                """)
            .param("id", UUID.randomUUID())
            .param("sessionId", sessionId)
            .param("seq", seq)
            .param("role", role)
            .param("text", text.length() > 600 ? text.substring(0, 600) : text)
            .param("goalMet", goalMet, Types.BOOLEAN)
            .param("now", Db.ts(now))
            .update();
    }

    public List<Turn> turns(UUID sessionId) {
        return jdbc.sql("SELECT role, text FROM roleplay_turns WHERE session_id = :id ORDER BY seq")
            .param("id", sessionId)
            .query((rs, n) -> new Turn(rs.getString("role"), rs.getString("text")))
            .list();
    }
}
