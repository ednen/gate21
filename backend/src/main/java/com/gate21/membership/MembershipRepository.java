package com.gate21.membership;

import com.gate21.common.Db;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class MembershipRepository {

    public record MembershipRow(UUID userId, Plan plan, String source, Instant startedAt, Instant expiresAt) {
    }

    private final JdbcClient jdbc;

    public MembershipRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<MembershipRow> find(UUID userId) {
        return jdbc.sql("SELECT * FROM memberships WHERE user_id = :userId")
            .param("userId", userId)
            .query((rs, n) -> new MembershipRow(
                rs.getObject("user_id", UUID.class),
                Plan.valueOf(rs.getString("plan")),
                rs.getString("source"),
                Db.instant(rs, "started_at"),
                Db.instant(rs, "expires_at")))
            .optional();
    }

    /** One membership row per user; a new purchase replaces the plan and its end date. */
    public void upsert(UUID userId, Plan plan, String source, Instant startedAt, Instant expiresAt, Instant now) {
        jdbc.sql("""
                INSERT INTO memberships (user_id, plan, source, started_at, expires_at, updated_at)
                VALUES (:userId, :plan, :source, :startedAt, :expiresAt, :now)
                ON CONFLICT (user_id) DO UPDATE SET
                    plan = EXCLUDED.plan, source = EXCLUDED.source, started_at = EXCLUDED.started_at,
                    expires_at = EXCLUDED.expires_at, updated_at = EXCLUDED.updated_at
                """)
            .param("userId", userId)
            .param("plan", plan.name())
            .param("source", source)
            .param("startedAt", Db.ts(startedAt))
            .param("expiresAt", Db.ts(expiresAt))
            .param("now", Db.ts(now))
            .update();
    }
}
