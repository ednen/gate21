package com.gate21.progress;

import static org.assertj.core.api.Assertions.assertThat;

import com.gate21.IntegrationTest;
import com.gate21.common.CurrentUser;
import com.gate21.progress.ProgressService.AttemptInput;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class ProgressIT extends IntegrationTest {

    @Autowired
    ProgressService progress;

    @Autowired
    JwtDecoder jwtDecoder;

    private static Map<String, Object> attempt(UUID clientId, String chapter, String step, Integer score, Instant at) {
        var m = new java.util.HashMap<String, Object>();
        m.put("clientId", clientId);
        m.put("chapter", chapter);
        m.put("step", step);
        m.put("score", score);
        m.put("occurredAt", at.toString());
        return m;
    }

    private Response sync(String token, List<Map<String, Object>> attempts) throws Exception {
        return postJson("/api/v1/progress/sync", token, Map.of("attempts", attempts));
    }

    @Test
    void aRetriedSyncNeverAwardsXpTwice() throws Exception {
        String token = token("Ozan");
        UUID clientId = UUID.randomUUID();
        var batch = List.of(attempt(clientId, "airport", "PRONOUNCE", 82, Instant.now()));

        Response first = sync(token, batch);
        Response retry = sync(token, batch);

        assertThat(first.body().path("accepted").asInt()).isEqualTo(1);
        assertThat(first.body().path("xpGained").asInt()).isEqualTo(15);
        assertThat(retry.body().path("accepted").asInt()).isZero();
        assertThat(retry.body().path("duplicates").asInt()).isEqualTo(1);
        assertThat(getJson("/api/v1/me", token).body().path("xp").asInt()).isEqualTo(15);
    }

    @Test
    void finishingAllSixStepsStampsThePassport() throws Exception {
        String token = token("Ozan");
        Instant now = Instant.now();
        List<Map<String, Object>> steps = new ArrayList<>();
        for (Step step : Step.values()) {
            Integer score = step == Step.DISCOVER || step == Step.RECOGNIZE ? null : 90;
            steps.add(attempt(UUID.randomUUID(), "hotel", step.name(), score, now));
        }

        Response r = sync(token, steps);
        assertThat(r.body().path("stampedChapters").get(0).asText()).isEqualTo("hotel");

        Response passport = getJson("/api/v1/progress/passport", token);
        var hotel = findChapter(passport, "hotel");
        assertThat(hotel.path("complete").asBoolean()).isTrue();
        assertThat(hotel.path("stars").asInt()).isEqualTo(3);
        assertThat(hotel.path("stamp").asText()).isEqualTo("HOTEL READY");
        assertThat(passport.body().path("stamps").asInt()).isEqualTo(1);
        assertThat(findChapter(passport, "transportation").path("unlocked").asBoolean()).isFalse();

        // Hotel is done, so today's mission moves on to the first unfinished chapter.
        assertThat(getJson("/api/v1/me", token).body().path("nextChapter").path("slug").asText()).isEqualTo("airport");
    }

    @Test
    void consecutiveDaysBuildAStreakAndAdvanceTheJourney() throws Exception {
        String token = token("Ozan");
        Instant now = Instant.now();
        Instant yesterday = now.minus(1, ChronoUnit.DAYS);
        Instant twoDaysAgo = now.minus(2, ChronoUnit.DAYS);

        sync(token, List.of(
            attempt(UUID.randomUUID(), "airport", "SURVIVE", 70, twoDaysAgo),
            attempt(UUID.randomUUID(), "airport", "SURVIVE", 70, yesterday),
            attempt(UUID.randomUUID(), "airport", "SURVIVE", 70, now)));

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("streak").asInt()).isEqualTo(3);
        assertThat(me.path("streakBest").asInt()).isEqualTo(3);
        assertThat(me.path("todayDone").asBoolean()).isTrue();
        // Two completed days before today: day 1 + 2 = day 3.
        assertThat(me.path("journeyDay").asInt()).isEqualTo(3);
    }

    @Test
    void aDayBelowTheDailyGoalDoesNotCount() throws Exception {
        String token = token("Ozan");
        sync(token, List.of(attempt(UUID.randomUUID(), "airport", "DISCOVER", null, Instant.now())));

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("todayXp").asInt()).isEqualTo(10);
        assertThat(me.path("todayDone").asBoolean()).isFalse();
        assertThat(me.path("streak").asInt()).isZero();
    }

    @Test
    void unknownChaptersAreRejected() throws Exception {
        Response r = sync(token("Ozan"), List.of(attempt(UUID.randomUUID(), "mars", "DISCOVER", null, Instant.now())));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.code()).isEqualTo("UNKNOWN_CHAPTER");
    }

    @Test
    void concurrentSyncsFromTwoDevicesLoseNoXp() throws Exception {
        String token = token("Ozan");
        UUID userId = CurrentUser.id(jwtDecoder.decode(token));
        int devices = 8;
        int perDevice = 5;

        ExecutorService pool = Executors.newFixedThreadPool(devices);
        try {
            List<Callable<Object>> jobs = new ArrayList<>();
            for (int d = 0; d < devices; d++) {
                jobs.add(() -> {
                    List<AttemptInput> batch = new ArrayList<>();
                    for (int i = 0; i < perDevice; i++) {
                        batch.add(new AttemptInput(UUID.randomUUID(), "restaurant", Step.DISCOVER, null, Instant.now()));
                    }
                    return progress.sync(userId, batch);
                });
            }
            for (Future<Object> f : pool.invokeAll(jobs)) {
                f.get();
            }
        } finally {
            pool.shutdown();
        }

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("xp").asInt()).isEqualTo(devices * perDevice * 10);
        assertThat(me.path("todayXp").asInt()).isEqualTo(devices * perDevice * 10);
    }

    private static com.fasterxml.jackson.databind.JsonNode findChapter(Response passport, String slug) {
        for (var c : passport.body().path("chapters")) {
            if (slug.equals(c.path("slug").asText())) {
                return c;
            }
        }
        throw new AssertionError("chapter " + slug + " missing");
    }
}
