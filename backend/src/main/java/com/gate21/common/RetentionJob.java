package com.gate21.common;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Nightly data retention. Raw rows older than 90 days are deleted; their totals already live in
 * daily_activity, chapter_progress and user_stats. The deletes are idempotent, so it is safe for
 * every instance to run the job.
 */
@Configuration
@EnableScheduling
public class RetentionJob {

    static final Duration KEEP_RAW = Duration.ofDays(90);
    private static final Logger log = LoggerFactory.getLogger(RetentionJob.class);

    private final JdbcClient jdbc;
    private final Clock clock;

    public RetentionJob(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    public void purge() {
        Instant now = clock.instant();
        Instant cutoff = now.minus(KEEP_RAW);
        int turns = delete("DELETE FROM roleplay_turns WHERE created_at < :cutoff", cutoff);
        int speech = delete("DELETE FROM speech_assessments WHERE created_at < :cutoff", cutoff);
        int attempts = delete("DELETE FROM attempts WHERE created_at < :cutoff", cutoff);
        int tokens = delete("DELETE FROM refresh_tokens WHERE expires_at < :cutoff", now.minus(Duration.ofDays(1)));
        int usage = jdbc.sql("DELETE FROM usage_counters WHERE day < CURRENT_DATE - 7").update();
        log.info("Retention purge: {} turns, {} assessments, {} attempts, {} refresh tokens, {} usage rows",
            turns, speech, attempts, tokens, usage);
    }

    private int delete(String sql, Instant cutoff) {
        return jdbc.sql(sql).param("cutoff", Db.ts(cutoff)).update();
    }
}
