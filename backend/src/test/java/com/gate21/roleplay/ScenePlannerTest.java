package com.gate21.roleplay;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentService;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ScenePlannerTest {

    private final ContentService content = new ContentService(
        JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build());
    private final Scenario hotel = content.scenario("hotel-checkin").orElseThrow();
    private final Scenario trip = content.scenario("full-trip").orElseThrow();

    @Test
    void oneSurpriseLandsRightAfterItsGoal() {
        List<String> plan = ScenePlanner.plan(hotel, Difficulty.READY, new Random(1));
        assertThat(plan).hasSize(hotel.goals().size() + 1);
        int breakfast = plan.indexOf("g:breakfast");
        assertThat(plan.get(breakfast + 1)).startsWith("t:");
    }

    @Test
    void proScenesGetTwoDifferentSurprises() {
        List<String> plan = ScenePlanner.plan(hotel, Difficulty.PRO, new Random(2));
        List<String> twists = plan.stream().filter(s -> s.startsWith("t:")).toList();
        assertThat(twists).hasSize(2).doesNotHaveDuplicates();
    }

    @Test
    void surprisesVaryBetweenPlayThroughs() {
        Set<String> seen = new HashSet<>();
        Random random = new Random(3);
        for (int i = 0; i < 40; i++) {
            ScenePlanner.plan(hotel, Difficulty.READY, random).stream().filter(s -> s.startsWith("t:")).forEach(seen::add);
        }
        assertThat(seen).containsExactlyInAnyOrder("t:room-not-ready", "t:overbooked", "t:card-declined");
    }

    @Test
    void factsAndNameAreFilledIn() {
        Map<String, String> facts = ScenePlanner.facts(hotel, new Random(4));
        List<SceneStep> steps = ScenePlanner.resolve(hotel, ScenePlanner.plan(hotel, Difficulty.READY, new Random(4)),
            facts, "Ozan");
        assertThat(steps.getFirst().hint()).isEqualTo("Hi, I have a reservation under Ozan.");
        SceneStep breakfast = steps.stream().filter(s -> s.id().equals("breakfast")).findFirst().orElseThrow();
        assertThat(breakfast.successReply()).contains(facts.get("breakfast")).doesNotContain("{");
    }

    @Test
    void fullTripChangesCharacterAtEachSegment() {
        List<SceneStep> steps = ScenePlanner.resolve(trip, ScenePlanner.plan(trip, Difficulty.READY, new Random(5)),
            ScenePlanner.facts(trip, new Random(5)), "Ozan");
        List<String> segmentRoles = steps.stream().filter(SceneStep::segmentStart).map(SceneStep::role).toList();
        assertThat(segmentRoles).containsExactly("Taxi driver", "Receptionist", "Waiter");
        assertThat(steps.getFirst().role()).isEqualTo("Airline staff");

        SceneStep traffic = steps.stream().filter(s -> s.id().equals("traffic")).findFirst().orElseThrow();
        assertThat(traffic.role()).as("a surprise belongs to the current character").isEqualTo("Taxi driver");
        assertThat(traffic.voice()).isEqualTo("en-GB");
    }

    @Test
    void scoreDropsForRetriesAndHintsButHasAFloor() {
        assertThat(RoleplayService.score(0, 0)).isEqualTo(100);
        assertThat(RoleplayService.score(1, 2)).isEqualTo(65);
        assertThat(RoleplayService.score(9, 9)).isEqualTo(40);
    }
}
