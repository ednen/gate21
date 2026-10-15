package com.gate21.placement;

import static org.assertj.core.api.Assertions.assertThat;

import com.gate21.IntegrationTest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlacementIT extends IntegrationTest {

    private static final List<Integer> ALL_CORRECT = List.of(1, 0, 1, 2, 1);

    @Test
    void aStrongResultSkipsAheadOnlyToWeeksThatHaveLessons() throws Exception {
        String token = token("Ozan");
        Response r = postJson("/api/v1/placement", token,
            Map.of("kind", "INITIAL", "answers", ALL_CORRECT, "speakingScores", List.of(90, 80)));

        // 10 base + 60 written + 30% of 85 speaking (26) = 96
        assertThat(r.body().path("score").asInt()).isEqualTo(96);
        assertThat(r.body().path("level").asText()).isEqualTo("Gold Traveller");
        assertThat(r.body().path("startDayApplied").asBoolean()).isTrue();
        // Gold lessons are not out yet, so the journey starts at the latest week that has them: Silver.
        assertThat(r.body().path("startDay").asInt()).isEqualTo(8);
        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("journeyDay").asInt()).isEqualTo(8);
        assertThat(me.path("levelId").asText()).isEqualTo("SILVER");
        assertThat(me.path("nextChapter").path("slug").asText()).isEqualTo("arrival-silver");
    }

    @Test
    void aZeroResultRecommendsTheStarterPackFirst() throws Exception {
        String token = token("Ozan");
        Response r = postJson("/api/v1/placement", token,
            Map.of("kind", "INITIAL", "answers", List.of(0, 1, 0, 0, 0)));

        // 10 base + 0 written + 0 speaking stand-in = 10
        assertThat(r.body().path("score").asInt()).isEqualTo(10);
        assertThat(r.body().path("startDay").asInt()).isEqualTo(1);
        assertThat(r.body().path("starter").asBoolean()).isTrue();
        assertThat(r.body().path("messageTr").asText()).contains("Başlangıç paketi");

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("starterRecommended").asBoolean()).isTrue();
        assertThat(me.path("nextChapter").path("slug").asText()).isEqualTo("starter-alphabet");
        assertThat(me.path("nextChapter").path("kind").asText()).isEqualTo("starter");
    }

    @Test
    void starterDaysDoNotUseUpTheJourney() throws Exception {
        String token = token("Ozan");
        postJson("/api/v1/placement", token, Map.of("kind", "INITIAL", "answers", List.of(0, 1, 0, 0, 0)));

        // Two busy days on the Starter pack, finishing all five lessons.
        Instant yesterday = Instant.now().minus(1, java.time.temporal.ChronoUnit.DAYS);
        Instant twoDaysAgo = Instant.now().minus(2, java.time.temporal.ChronoUnit.DAYS);
        List<Map<String, Object>> attempts = new java.util.ArrayList<>();
        Map<String, List<String>> steps = Map.of(
            "starter-alphabet", List.of("DISCOVER", "PRONOUNCE", "MATCH", "RECOGNIZE"),
            "starter-numbers", List.of("DISCOVER", "PRONOUNCE", "MATCH", "RECOGNIZE"),
            "starter-spelling", List.of("DISCOVER", "MATCH", "RECOGNIZE", "DIALOG"),
            "starter-people", List.of("DISCOVER", "MATCH", "RECOGNIZE", "DIALOG"),
            "starter-basics", List.of("DISCOVER", "PRONOUNCE", "MATCH", "SPEAK"));
        int i = 0;
        for (var e : steps.entrySet()) {
            for (String step : e.getValue()) {
                attempts.add(Map.of("clientId", UUID.randomUUID(), "chapter", e.getKey(), "step", step,
                    "occurredAt", (i++ % 2 == 0 ? yesterday : twoDaysAgo).toString()));
            }
        }
        assertThat(postJson("/api/v1/progress/sync", token, Map.of("attempts", attempts)).status()).isEqualTo(200);

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("starterDone").asBoolean()).isTrue();
        assertThat(me.path("journeyDay").asInt()).isEqualTo(1);
        assertThat(me.path("nextChapter").path("slug").asText()).isEqualTo("arrival-bronze");
        // Starter lessons are not places, so they stamp no passport page.
        assertThat(getJson("/api/v1/progress/passport", token).body().path("stamps").asInt()).isZero();
    }

    @Test
    void retakingAfterTheJourneyStartedDoesNotMoveTheStartDay() throws Exception {
        String token = token("Ozan");
        postJson("/api/v1/progress/sync", token, Map.of("attempts", List.of(Map.of(
            "clientId", UUID.randomUUID(), "chapter", "arrival-bronze", "step", "DISCOVER",
            "occurredAt", Instant.now().toString()))));

        Response r = postJson("/api/v1/placement", token,
            Map.of("kind", "INITIAL", "answers", ALL_CORRECT, "speakingScores", List.of(100, 100)));
        assertThat(r.body().path("startDayApplied").asBoolean()).isFalse();
        assertThat(getJson("/api/v1/me", token).body().path("journeyDay").asInt()).isEqualTo(1);
    }

    @Test
    void finalCheckIsStoredForTheBeforeAfterScreen() throws Exception {
        String token = token("Ozan");
        postJson("/api/v1/placement", token, Map.of("kind", "INITIAL", "answers", List.of(0, 1, 0, 2, 0)));
        postJson("/api/v1/placement", token, Map.of("kind", "FINAL", "answers", ALL_CORRECT, "speakingScores", List.of(80)));

        var me = getJson("/api/v1/me", token).body();
        assertThat(me.path("placementScore").asInt()).isLessThan(me.path("finalScore").asInt());
    }

    @Test
    void wrongNumberOfAnswersIsRejected() throws Exception {
        Response r = postJson("/api/v1/placement", token("Ozan"), Map.of("kind", "INITIAL", "answers", List.of(1, 2)));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.code()).isEqualTo("WRONG_ANSWER_COUNT");
    }
}
