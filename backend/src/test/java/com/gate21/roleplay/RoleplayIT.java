package com.gate21.roleplay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.gate21.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RoleplayIT extends IntegrationTest {

    private Response say(String token, String sessionId, String text) throws Exception {
        return call(multipart("/api/v1/roleplay/sessions/" + sessionId + "/turns")
            .param("text", text)
            .header("Authorization", "Bearer " + token));
    }

    @Test
    void hotelCheckInRunsThroughTheTwistToTheEnd() throws Exception {
        String token = token("Ozan");
        Response start = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "hotel-checkin"));
        assertThat(start.status()).isEqualTo(201);
        assertThat(start.body().path("reply").asText()).startsWith("Hello, welcome to the Grand Hotel");
        assertThat(start.body().path("hint").asText()).isEqualTo("Hi, I have a reservation under Ozan.");
        String id = start.body().path("sessionId").asText();

        Response wrong = say(token, id, "Good morning!");
        assertThat(wrong.body().path("goalMet").asBoolean()).isFalse();
        assertThat(wrong.body().path("goalIndex").asInt()).isZero();

        Response reservation = say(token, id, "Hi, I have a reservation under Ozan.");
        assertThat(reservation.body().path("goalMet").asBoolean()).isTrue();
        assertThat(reservation.body().path("reply").asText()).contains("passport");

        Response passport = say(token, id, "Sure, here you are.");
        assertThat(passport.body().path("twist").asBoolean()).isTrue();
        assertThat(passport.body().path("reply").asText()).contains("isn't ready");
        assertThat(passport.body().path("hintOptions")).hasSize(3);

        Response solved = say(token, id, "Could I leave my luggage here?");
        assertThat(solved.body().path("completed").asBoolean()).isTrue();
        assertThat(solved.body().path("done").asBoolean()).isTrue();
        assertThat(solved.body().path("reply").asText()).contains("keep it safe");

        Response afterEnd = say(token, id, "Thanks!");
        assertThat(afterEnd.status()).isEqualTo(409);
        assertThat(afterEnd.code()).isEqualTo("SESSION_FINISHED");
    }

    @Test
    void anotherUsersSessionIsInvisible() throws Exception {
        String owner = token("Ozan");
        String id = postJson("/api/v1/roleplay/sessions", owner, Map.of("scenario", "airport-checkin"))
            .body().path("sessionId").asText();

        Response r = say(token("Eve"), id, "Here you are");
        assertThat(r.status()).isEqualTo(404);
    }

    @Test
    void unknownScenarioIs404() throws Exception {
        Response r = postJson("/api/v1/roleplay/sessions", token("Ozan"), Map.of("scenario", "moon-base"));
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.code()).isEqualTo("SCENARIO_NOT_FOUND");
    }

    @Test
    void sessionsPerDayAreLimited() throws Exception {
        String token = token("Ozan");
        // The test profile allows 5 sessions a day.
        for (int i = 0; i < 5; i++) {
            assertThat(postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "restaurant-order")).status())
                .isEqualTo(201);
        }
        Response blocked = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "restaurant-order"));
        assertThat(blocked.status()).isEqualTo(429);
        assertThat(blocked.code()).isEqualTo("ROLEPLAY_QUOTA_EXCEEDED");
    }
}
