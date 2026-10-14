package com.gate21.auth;

import com.gate21.common.ApiException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Fixed one-minute window per (IP, email). In-memory, so the limit is per instance; with
 * several instances it moves to Redis (see the architecture doc).
 */
@Component
public class LoginRateLimiter {

    private static final int MAX_KEYS = 50_000;

    private record Window(long minute, AtomicInteger count) {
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int maxPerMinute;

    public LoginRateLimiter(@Value("${gate21.auth.attempts-per-minute:5}") int maxPerMinute) {
        this.maxPerMinute = maxPerMinute;
    }

    public void check(String ip, String email) {
        long minute = System.currentTimeMillis() / 60_000;
        if (windows.size() > MAX_KEYS) {
            windows.entrySet().removeIf(e -> e.getValue().minute() < minute);
        }
        String key = ip + "|" + email;
        Window window = windows.compute(key, (k, w) -> w == null || w.minute() != minute
            ? new Window(minute, new AtomicInteger())
            : w);
        if (window.count().incrementAndGet() > maxPerMinute) {
            throw ApiException.tooManyRequests("TOO_MANY_ATTEMPTS", "Too many attempts. Wait a minute and try again.");
        }
    }
}
