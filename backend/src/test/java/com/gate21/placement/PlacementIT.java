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
    void aStrongResultStartsTheJourneyInWeekThree() throws Exception {
        String token = token("Ozan");
        Response r = postJson("/api/v1/placement", token,
            Map.of("kind", "INITIAL", "answers", ALL_CORRECT, "speakingScores", List.of(90, 80)));

        // 10 base + 60 written + 30% of 85 speaking (26) = 96
        assertThat(r.body().path("score").asInt()).isEqualTo(96);
        assertThat(r.body().path("level").asText()).isEqualTo("Travel Pro");
        assertThat(r.body().path("startDayApplied").asBoolean()).isTrue();
        assertThat(getJson("/api/v1/me", token).body().path("journeyDay").asInt()).isEqualTo(15);
    }

    @Test
    void aWeakResultStartsOnDayOne() throws Exception {
        String token = token("Ozan");
        Response r = postJson("/api/v1/placement", token,
            Map.of("kind", "INITIAL", "answers", List.of(0, 1, 0, 0, 0)));

        // 10 base + 0 written + 0 speaking stand-in = 10
        assertThat(r.body().path("score").asInt()).isEqualTo(10);
        assertThat(r.body().path("startDay").asInt()).isEqualTo(1);
        assertThat(r.body().path("messageTr").asText()).contains("baskı altında");
    }

    @Test
    void retakingAfterTheJourneyStartedDoesNotMoveTheStartDay() throws Exception {
        String token = token("Ozan");
        postJson("/api/v1/progress/sync", token, Map.of("attempts", List.of(Map.of(
            "clientId", UUID.randomUUID(), "chapter", "airport", "step", "DISCOVER",
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
