package com.gate21.progress;

import static org.assertj.core.api.Assertions.assertThat;

import com.gate21.IntegrationTest;
import com.gate21.common.CurrentUser;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentService;
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

    @Autowired
    ContentService content;

    /** One attempt for every step the chapter has, all scored 90. */
    private List<Map<String, Object>> allSteps(String chapter, Instant at) {
        int bits = content.chapterMeta(chapter).orElseThrow().requiredBits();
        List<Map<String, Object>> attempts = new ArrayList<>();
        for (Step step : Step.values()) {
            if ((bits & step.bit()) != 0) {
                attempts.add(attempt(UUID.randomUUID(), chapter, step.name(), 90, at));
            }
        }
        return attempts;
    }

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
        var batch = List.of(attempt(clientId, "arrival-bronze", "PRONOUNCE", 82, Instant.now()));

        Response first = sync(token, batch);
        Response retry = sync(token, batch);

        assertThat(first.body().path("accepted").asInt()).isEqualTo(1);
        assertThat(first.body().path("xpGained").asInt()).isEqualTo(15);
        assertThat(retry.body().path("accepted").asInt()).isZero();
        assertThat(retry.body().path("duplicates").asInt()).isEqualTo(1);
        assertThat(getJson("/api/v1/me", token).body().path("xp").asInt()).isEqualTo(15);
    }

    @Test
    void finishingEveryStepOfAChapterStampsThePassport() throws Exception {
        String token = token("Ozan");
        Response r = sync(token, allSteps("hotel-bronze", Instant.now()));
        assertThat(r.body().path("stampedChapters").get(0).asText()).isEqualTo("hotel-bronze");
        assertThat(r.body().path("levelsEarned")).isEmpty();

        Response passport = getJson("/api/v1/progress/passport", token);
        var hotel = findChapter(passport, "hotel-bronze");
        assertThat(hotel.path("complete").asBoolean()).isTrue();
        assertThat(hotel.path("totalSteps").asInt()).isEqualTo(6);
        assertThat(hotel.path("doneSteps")).hasSize(6);
        assertThat(hotel.path("doneSteps").toString()).contains("MATCH", "SURVIVE");
        assertThat(hotel.path("stars").asInt()).isEqualTo(3);
        assertThat(hotel.path("stamp").asText()).isEqualTo("CHECKED IN");
        assertThat(hotel.path("stop").asText()).isEqualTo("hotel");
        assertThat(passport.body().path("stamps").asInt()).isEqualTo(1);
        assertThat(findChapter(passport, "hotel-silver").path("unlocked").asBoolean()).isFalse();

        // Hotel is done, so today's mission moves on to the first unfinished chapter.
        assertThat(getJson("/api/v1/me", token).body().path("nextChapter").path("slug").asText()).isEqualTo("arrival-bronze");
    }

    @Test
    void finishingAllSevenStopsEarnsTheBronzeBadge() throws Exception {
        String token = token("Ozan");
        List<Map<String, Object>> attempts = new ArrayList<>();
        for (ChapterInfo lesson : content.lessonsOfWeek(1)) {
            attempts.addAll(allSteps(lesson.slug(), Instant.now()));
        }
        Response r = sync(token, attempts);
        assertThat(r.body().path("levelsEarned").get(0).asText()).isEqualTo("BRONZE");
        assertThat(r.body().path("graduated").asBoolean()).isFalse();

        var levels = getJson("/api/v1/progress/passport", token).body().path("levels");
        assertThat(levels.get(0).path("earned").asBoolean()).isTrue();
        assertThat(levels.get(0).path("tagline").asText()).isEqualTo("Your journey has begun!");
        assertThat(levels.get(0).path("lessonsDone").asInt()).isEqualTo(7);
        assertThat(levels.get(1).path("earned").asBoolean()).isFalse();

        // Earned once: replaying a lesson does not award the badge again.
        assertThat(sync(token, allSteps("cafe-bronze", Instant.now())).body().path("levelsEarned")).isEmpty();
    }

    @Test
    void finishingAllTwentyOneDaysEarnsEveryBadgeAndGraduates() throws Exception {
        String token = token("Ozan");
        List<Map<String, Object>> attempts = new ArrayList<>();
        for (int week = 1; week <= 3; week++) {
            for (ChapterInfo lesson : content.lessonsOfWeek(week)) {
                attempts.addAll(allSteps(lesson.slug(), Instant.now()));
            }
        }
        assertThat(attempts.size()).isLessThanOrEqualTo(200);
        Response r = sync(token, attempts);
        assertThat(r.body().path("levelsEarned").toString()).contains("BRONZE", "SILVER", "GOLD");
        assertThat(r.body().path("graduated").asBoolean()).isTrue();

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("graduatedAt").isNull()).isFalse();
        // Every lesson is done; the Full Trip finale is what is left.
        assertThat(me.path("nextChapter").path("slug").asText()).isEqualTo("full-trip");
        assertThat(getJson("/api/v1/progress/passport", token).body().path("levels").get(2).path("earned").asBoolean()).isTrue();

        // Graduating happens once.
        assertThat(sync(token, allSteps("cafe-gold", Instant.now())).body().path("graduated").asBoolean()).isFalse();
    }

    @Test
    void fullTripIsOneStepAndStaysOutOfTheMissionUntilWeekThree() throws Exception {
        String token = token("Ozan");
        Response passport = getJson("/api/v1/progress/passport", token);
        var trip = findChapter(passport, "full-trip");
        assertThat(trip.path("totalSteps").asInt()).isEqualTo(1);
        assertThat(trip.path("unlocked").asBoolean()).isFalse();
        assertThat(findChapter(passport, "arrival-bronze").path("totalSteps").asInt()).isEqualTo(6);

        Response r = sync(token, List.of(attempt(UUID.randomUUID(), "full-trip", "SURVIVE", 90, Instant.now())));
        assertThat(r.body().path("stampedChapters").get(0).asText()).isEqualTo("full-trip");
        assertThat(getJson("/api/v1/me", token).body().path("nextChapter").path("slug").asText()).isEqualTo("arrival-bronze");
    }

    @Test
    void consecutiveDaysBuildAStreakAndAdvanceTheJourney() throws Exception {
        String token = token("Ozan");
        Instant now = Instant.now();
        Instant yesterday = now.minus(1, ChronoUnit.DAYS);
        Instant twoDaysAgo = now.minus(2, ChronoUnit.DAYS);

        sync(token, List.of(
            attempt(UUID.randomUUID(), "arrival-bronze", "SURVIVE", 70, twoDaysAgo),
            attempt(UUID.randomUUID(), "arrival-bronze", "SURVIVE", 70, yesterday),
            attempt(UUID.randomUUID(), "arrival-bronze", "SURVIVE", 70, now)));

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
        sync(token, List.of(attempt(UUID.randomUUID(), "arrival-bronze", "DISCOVER", null, Instant.now())));

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
                        batch.add(new AttemptInput(UUID.randomUUID(), "restaurant-bronze", Step.DISCOVER, null, Instant.now()));
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

    @Test
    void practiceDaysCountTowardsTheWeeklyGoal() throws Exception {
        String token = token("Ozan");
        assertThat(postJson("/api/v1/practice/done", token, Map.of()).code()).isEqualTo("MEMBERSHIP_REQUIRED");

        withJourney(token);
        Response done = postJson("/api/v1/practice/done", token, Map.of());
        assertThat(done.status()).isEqualTo(200);
        assertThat(done.body().path("thisWeek").asInt()).isEqualTo(1);
        assertThat(getJson("/api/v1/me", token).body().path("practice").path("thisWeek").asInt()).isEqualTo(1);
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
