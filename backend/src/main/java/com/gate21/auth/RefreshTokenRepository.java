package com.gate21.auth;

import com.gate21.common.Db;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RefreshTokenRepository {

    public record TokenRow(UUID id, UUID userId, Instant expiresAt, Instant revokedAt) {
    }

    private final JdbcClient jdbc;

    public RefreshTokenRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(UUID userId, String tokenHash, Instant expiresAt, Instant now) {
        jdbc.sql("""
                INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
                VALUES (:id, :userId, :hash, :expiresAt, :now)
                """)
            .param("id", UUID.randomUUID())
            .param("userId", userId)
            .param("hash", tokenHash)
            .param("expiresAt", Db.ts(expiresAt))
            .param("now", Db.ts(now))
            .update();
    }

    /** Locks the row so two concurrent refreshes with the same token are serialized. */
    public Optional<TokenRow> lockByHash(String tokenHash) {
        return jdbc.sql("SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = :hash FOR UPDATE")
            .param("hash", tokenHash)
            .query((rs, n) -> new TokenRow(
                rs.getObject("id", UUID.class),
                rs.getObject("user_id", UUID.class),
                Db.instant(rs, "expires_at"),
                Db.instant(rs, "revoked_at")))
            .optional();
    }

    public void revoke(UUID id, Instant now) {
        jdbc.sql("UPDATE refresh_tokens SET revoked_at = :now WHERE id = :id AND revoked_at IS NULL")
            .param("now", Db.ts(now))
            .param("id", id)
            .update();
    }

    public void revokeAllForUser(UUID userId, Instant now) {
        jdbc.sql("UPDATE refresh_tokens SET revoked_at = :now WHERE user_id = :userId AND revoked_at IS NULL")
            .param("now", Db.ts(now))
            .param("userId", userId)
            .update();
    }
}
