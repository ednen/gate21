package com.gate21.membership;

import java.time.Duration;

/**
 * What a learner can buy. JOURNEY unlocks the whole 21-day programme; KEEP_READY is the
 * cheaper follow-up for graduates (practice tools and scene replays). Both unlock every
 * chapter; the free tier is the Starter pack and the first {@code freeDays} journey days.
 */
public enum Plan {
    JOURNEY(Duration.ofDays(60)),
    KEEP_READY(Duration.ofDays(30));

    private final Duration length;

    Plan(Duration length) {
        this.length = length;
    }

    public Duration length() {
        return length;
    }
}
