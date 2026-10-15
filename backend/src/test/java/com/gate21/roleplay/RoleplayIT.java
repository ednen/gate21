package com.gate21.roleplay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.gate21.IntegrationTest;
import com.gate21.common.CurrentUser;
import com.gate21.content.ContentService;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class RoleplayIT extends IntegrationTest {

    @Autowired
    RoleplayRepository sessions;

    @Autowired
    ContentService content;

    @Autowired
    JwtDecoder jwtDecoder;

    private Response say(String token, String sessionId, String text, boolean hintUsed) throws Exception {
        return call(multipart("/api/v1/roleplay/sessions/" + sessionId + "/turns")
            .param("text", text)
            .param("hintUsed", String.valueOf(hintUsed))
            .header("Authorization", "Bearer " + token));
    }

    private Response report(String token, String sessionId) throws Exception {
        return call(get("/api/v1/roleplay/sessions/" + sessionId + "/report").header("Authorization", "Bearer " + token));
    }

    /**
     * The app's own suggestion for the current step, read from the stored plan so it also works
     * in Gold scenes, which show no hints.
     */
    private String suggestion(String token, JsonNode view) throws Exception {
        UUID userId = CurrentUser.id(jwtDecoder.decode(token));
        var session = sessions.findSession(UUID.fromString(view.path("sessionId").asText()), userId).orElseThrow();
        List<String> plan = mapper.readValue(session.planJson(), new TypeReference<List<String>>() { });
        Map<String, String> facts = mapper.readValue(session.factsJson(), new TypeReference<Map<String, String>>() { });
        var scenario = content.scenario(session.scenarioSlug()).orElseThrow();
        SceneStep step = ScenePlanner.resolve(scenario, plan, facts, "Ozan").get(view.path("stepIndex").asInt());
        return step.twist() ? step.options().getFirst().text() : step.hint();
    }

    /** Plays a scene by always saying the app's own suggestion. Returns every view, start included. */
    private List<JsonNode> playThrough(String token, String scenario) throws Exception {
        List<JsonNode> views = new ArrayList<>();
        JsonNode view = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", scenario)).body();
        views.add(view);
        String id = view.path("sessionId").asText();
        for (int i = 0; i < 40 && !view.path("done").asBoolean(); i++) {
            view = say(token, id, suggestion(token, view), false).body();
            views.add(view);
        }
        return views;
    }

    private static List<String> kinds(List<JsonNode> views) {
        List<String> kinds = new ArrayList<>();
        views.forEach(v -> v.path("messages").forEach(m -> kinds.add(m.path("kind").asText())));
        return kinds;
    }

    @Test
    void hotelCheckInIsALongerConversationWithOneSurprise() throws Exception {
        String token = withJourney(token("Ozan"));
        List<JsonNode> views = playThrough(token, "hotel-bronze");
        JsonNode start = views.getFirst();
        JsonNode last = views.getLast();

        assertThat(start.path("difficulty").asText()).isEqualTo("BRONZE");
        assertThat(start.path("messages").get(0).path("text").asText()).startsWith("Good afternoon, welcome to the Grand Hotel");
        assertThat(start.path("hint").asText()).isEqualTo("Hi, I have a reservation under Ozan.");
        assertThat(start.path("briefTr").asText()).contains("Ozan");
        assertThat(start.path("totalSteps").asInt()).isEqualTo(6);

        assertThat(views).hasSize(7);
        assertThat(kinds(views)).containsOnlyOnce("twist").contains("closing");
        assertThat(last.path("completed").asBoolean()).isTrue();
        assertThat(last.path("messages").get(last.path("messages").size() - 1).path("text").asText())
            .startsWith("Here's your key card — room ");
    }

    @Test
    void theReportCoachesEveryLineAndChecksMemory() throws Exception {
        String token = withJourney(token("Ozan"));
        List<JsonNode> views = playThrough(token, "hotel-bronze");
        String id = views.getFirst().path("sessionId").asText();

        Response r = report(token, id);
        assertThat(r.status()).isEqualTo(200);
        JsonNode body = r.body();
        assertThat(body.path("completed").asBoolean()).isTrue();
        assertThat(body.path("score").asInt()).isEqualTo(100);
        assertThat(body.path("lines")).hasSize(6);
        assertThat(body.path("lines").get(0).path("better").asText()).isNotBlank();
        assertThat(body.path("hardestTr").asText()).isNotBlank();
        assertThat(body.path("phrases")).isNotEmpty();

        // Room, breakfast and Wi-Fi were all said, so all three are asked back; the right answer is what was said.
        String everything = views.toString();
        assertThat(body.path("memory")).hasSize(3);
        for (JsonNode q : body.path("memory")) {
            assertThat(q.path("options")).hasSize(3);
            assertThat(everything).contains(q.path("options").get(q.path("answer").asInt()).asText());
        }
        // Stored once: asking again returns the same report.
        assertThat(report(token, id).body().toString()).isEqualTo(body.toString());

        // Its phrases become practice material.
        JsonNode practice = getJson("/api/v1/practice", token).body();
        assertThat(practice.path("phrases")).isNotEmpty();
        assertThat(practice.path("weeklyGoal").asInt()).isEqualTo(2);
    }

    @Test
    void retriesAndHintsLowerTheScore() throws Exception {
        String token = withJourney(token("Ozan"));
        JsonNode view = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "restaurant-bronze")).body();
        String id = view.path("sessionId").asText();

        JsonNode wrong = say(token, id, "Good morning!", false).body();
        assertThat(wrong.path("goalMet").asBoolean()).isFalse();
        assertThat(wrong.path("stepIndex").asInt()).isZero();

        view = say(token, id, view.path("hint").asText(), true).body();
        while (!view.path("done").asBoolean()) {
            view = say(token, id, suggestion(token, view), false).body();
        }
        assertThat(report(token, id).body().path("score").asInt()).isEqualTo(100 - 15 - 10);
    }

    @Test
    void theFirstFreeDaysNeedNoPlanButTheRestDoes() throws Exception {
        String token = token("Ozan");
        assertThat(postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "arrival-bronze")).status())
            .isEqualTo(201);
        assertThat(postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "transfer-bronze")).status())
            .isEqualTo(201);

        Response locked = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "hotel-bronze"));
        assertThat(locked.status()).isEqualTo(402);
        assertThat(locked.code()).isEqualTo("MEMBERSHIP_REQUIRED");

        withJourney(token);
        assertThat(getJson("/api/v1/me", token).body().path("membership").path("plan").asText()).isEqualTo("JOURNEY");
        assertThat(postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "hotel-bronze")).status())
            .isEqualTo(201);
    }

    @Test
    void theReportWaitsForTheSceneToEnd() throws Exception {
        String token = token("Ozan");
        String id = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "arrival-bronze"))
            .body().path("sessionId").asText();
        Response r = report(token, id);
        assertThat(r.status()).isEqualTo(409);
        assertThat(r.code()).isEqualTo("SESSION_ACTIVE");
    }

    @Test
    void fullTripIsAGoldSceneHandedFromCharacterToCharacter() throws Exception {
        String token = withJourney(token("Ozan"));
        List<JsonNode> views = playThrough(token, "full-trip");
        JsonNode start = views.getFirst();
        JsonNode last = views.getLast();

        assertThat(start.path("difficulty").asText()).isEqualTo("GOLD");
        assertThat(start.path("hintsAllowed").asBoolean()).isFalse();
        assertThat(start.path("hint").isNull()).isTrue();
        // Nine goals; two surprises from the first slot and one from each of the other three.
        assertThat(start.path("totalSteps").asInt()).isEqualTo(9 + 2 + 3);
        assertThat(last.path("completed").asBoolean()).isTrue();

        List<String> roles = new ArrayList<>();
        views.forEach(v -> v.path("messages").forEach(m -> {
            if ("transition".equals(m.path("kind").asText())) {
                roles.add(m.path("role").asText());
            }
        }));
        assertThat(roles).containsExactly("Taxi driver", "Receptionist", "Waiter");
        assertThat(views.size() - 1).as("turns").isGreaterThanOrEqualTo(14);

        JsonNode report = report(token, start.path("sessionId").asText()).body();
        assertThat(report.path("memory")).hasSize(4);
    }

    @Test
    void anotherUsersSessionIsInvisible() throws Exception {
        String owner = token("Ozan");
        String id = postJson("/api/v1/roleplay/sessions", owner, Map.of("scenario", "arrival-bronze"))
            .body().path("sessionId").asText();

        assertThat(say(token("Eve"), id, "Here you are", false).status()).isEqualTo(404);
        assertThat(report(token("Eve"), id).status()).isEqualTo(404);
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
            assertThat(postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "arrival-bronze")).status())
                .isEqualTo(201);
        }
        Response blocked = postJson("/api/v1/roleplay/sessions", token, Map.of("scenario", "arrival-bronze"));
        assertThat(blocked.status()).isEqualTo(429);
        assertThat(blocked.code()).isEqualTo("ROLEPLAY_QUOTA_EXCEEDED");
    }
}
