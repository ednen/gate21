package com.gate21.common;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Daily per-user quotas for the paid providers. Counters live in PostgreSQL so every API
 * instance sees the same numbers; the increment is a single atomic upsert.
 */
@Service
public class QuotaService {

    public static final String SPEECH = "speech";
    public static final String ROLEPLAY = "roleplay";

    private final JdbcClient jdbc;
    private final Clock clock;

    public QuotaService(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Takes one unit of today's quota or throws 429 with {@code code} when the limit is reached. */
    public void consume(UUID userId, String kind, int limit, String code) {
        LocalDate day = LocalDate.now(clock);
        int used = jdbc.sql("""
                INSERT INTO usage_counters (user_id, day, kind, count) VALUES (:userId, :day, :kind, 1)
                ON CONFLICT (user_id, day, kind) DO UPDATE SET count = usage_counters.count + 1
                RETURNING count
                """)
            .param("userId", userId)
            .param("day", day)
            .param("kind", kind)
            .query(Integer.class)
            .single();
        if (used > limit) {
            release(userId, kind);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, code, "Daily limit reached. Try again tomorrow.");
        }
    }

    /** Gives a unit back, used when the provider call failed after the quota was taken. */
    public void release(UUID userId, String kind) {
        jdbc.sql("""
                UPDATE usage_counters SET count = count - 1
                WHERE user_id = :userId AND day = :day AND kind = :kind AND count > 0
                """)
            .param("userId", userId)
            .param("day", LocalDate.now(clock))
            .param("kind", kind)
            .update();
    }

    public int used(UUID userId, String kind) {
        return jdbc.sql("SELECT count FROM usage_counters WHERE user_id = :userId AND day = :day AND kind = :kind")
            .param("userId", userId)
            .param("day", LocalDate.now(clock))
            .param("kind", kind)
            .query(Integer.class)
            .optional()
            .orElse(0);
    }
}
