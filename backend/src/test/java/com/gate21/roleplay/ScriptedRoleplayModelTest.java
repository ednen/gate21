package com.gate21.roleplay;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentService;
import com.gate21.roleplay.RoleplayModel.Context;
import com.gate21.roleplay.RoleplayModel.Reply;
import com.gate21.roleplay.RoleplayModel.Review;
import com.gate21.roleplay.RoleplayModel.ReviewContext;
import com.gate21.roleplay.RoleplayModel.UserLine;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ScriptedRoleplayModelTest {

    private final ContentService content = new ContentService(
        JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build());
    private final Scenario hotel = content.scenario("hotel-bronze").orElseThrow();
    private final List<SceneStep> steps = ScenePlanner.resolve(hotel,
        List.of("g:reservation", "g:passport", "g:nights", "g:breakfast", "t:room-not-ready", "g:wifi"),
        Map.of("room", "512", "breakfast", "7 to 10", "wifi", "garden2026"), "Ozan");
    private final ScriptedRoleplayModel model = new ScriptedRoleplayModel();

    private Reply say(int step, String text) {
        return model.respond(new Context(steps.get(step), List.of(), text, "Ozan"));
    }

    @Test
    void reservationGoalNeedsTheKeyword() {
        assertThat(say(0, "Hi, I have a reservation under Ozan.").goalMet()).isTrue();
        assertThat(say(0, "Hello!").goalMet()).isFalse();
        assertThat(say(0, "Hello!").reply()).isEqualTo(steps.get(0).retryReply());
    }

    @Test
    void keywordsMatchWholeWordsOnly() {
        // "where" contains "here" but must not satisfy the passport goal.
        assertThat(say(1, "Where?").goalMet()).isFalse();
        assertThat(say(1, "Sure, here you are.").goalMet()).isTrue();
    }

    @Test
    void twistPicksTheBestMatchingOption() {
        Reply luggage = say(4, "Could I leave my luggage here?");
        assertThat(luggage.goalMet()).isTrue();
        assertThat(luggage.optionIndex()).isZero();
        assertThat(say(4, "When will it be ready?").optionIndex()).isEqualTo(1);
        assertThat(say(4, "Is another room available?").optionIndex()).isEqualTo(2);
        assertThat(say(4, "OK").goalMet()).isFalse();
    }

    @Test
    void reviewNamesTheHardestStepAndSuggestsBetterLines() {
        List<UserLine> lines = List.of(
            new UserLine("Hi, I have a reservation under Ozan.", "reservation", true),
            new UserLine("Yes", "passport", false),
            new UserLine("Here.", "passport", true));
        Review review = model.review(new ReviewContext("AI Receptionist", List.of(), lines, steps));

        assertThat(review.lines()).hasSize(3);
        assertThat(review.lines().get(0).ok()).isTrue();
        assertThat(review.lines().get(1).ok()).isFalse();
        assertThat(review.lines().get(1).better()).isEqualTo("Sure, here you are.");
        assertThat(review.hardestTr()).contains("Pasaportu vermek");
        assertThat(review.phrases()).hasSize(3);
        assertThat(review.phrases().getFirst().en()).isEqualTo("Sure, here you are.");
    }
}
