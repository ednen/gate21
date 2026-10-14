package com.gate21.roleplay;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentService;
import com.gate21.roleplay.RoleplayModel.Context;
import com.gate21.roleplay.RoleplayModel.Reply;
import java.util.List;
import org.junit.jupiter.api.Test;

class ScriptedRoleplayModelTest {

    private final ContentService content = new ContentService(
        JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build());
    private final Scenario hotel = content.scenario("hotel-checkin").orElseThrow();
    private final ScriptedRoleplayModel model = new ScriptedRoleplayModel();

    private Reply say(int goal, String text) {
        return model.respond(new Context(hotel, goal, List.of(), text, "Ozan"));
    }

    @Test
    void reservationGoalNeedsTheKeyword() {
        assertThat(say(0, "Hi, I have a reservation under Ozan.").goalMet()).isTrue();
        assertThat(say(0, "Hello!").goalMet()).isFalse();
        assertThat(say(0, "Hello!").reply()).isEqualTo(hotel.goals().get(0).retryReply());
    }

    @Test
    void keywordsMatchWholeWordsOnly() {
        // "where" contains "here" but must not satisfy the passport goal.
        assertThat(say(1, "Where?").goalMet()).isFalse();
        assertThat(say(1, "Sure, here you are.").goalMet()).isTrue();
    }

    @Test
    void twistPicksTheBestMatchingOption() {
        Reply luggage = say(2, "Could I leave my luggage here?");
        assertThat(luggage.goalMet()).isTrue();
        assertThat(luggage.optionIndex()).isZero();
        assertThat(say(2, "When will it be ready?").optionIndex()).isEqualTo(1);
        assertThat(say(2, "Is another room available?").optionIndex()).isEqualTo(2);
        assertThat(say(2, "OK").goalMet()).isFalse();
    }
}
