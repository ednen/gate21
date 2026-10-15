package com.gate21.content;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.roleplay.RoleplayModel.Context;
import com.gate21.roleplay.RoleplayModel.Reply;
import com.gate21.roleplay.SceneStep;
import com.gate21.roleplay.ScenePlanner;
import com.gate21.roleplay.ScriptedRoleplayModel;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Loading the service runs every cross-reference check on the real content packs. */
class ContentServiceTest {

    private final ContentService content = new ContentService(
        JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build());

    @Test
    void everyAvailableChapterHasItsMissionAndScenario() {
        assertThat(content.availableChapters().stream().map(ChapterInfo::slug).toList())
            .containsExactly("airport", "hotel", "restaurant", "shopping", "full-trip");
        for (ChapterInfo chapter : content.availableChapters()) {
            var meta = content.chapterMeta(chapter.slug()).orElseThrow();
            assertThat(meta.mission()).isNotBlank();
            assertThat(meta.stamp()).isNotBlank();
            assertThat(content.scenario(meta.scenario())).isPresent();
        }
        assertThat(content.chapterMeta("full-trip").orElseThrow().simulation()).isTrue();
        assertThat(content.chapterMeta("hotel").orElseThrow().simulation()).isFalse();
    }

    @Test
    void everyScenarioHasSurprisesFactsAndAClosing() {
        for (Scenario s : scenarios()) {
            assertThat(s.twistSlots()).as(s.slug()).isNotEmpty();
            assertThat(s.facts()).as(s.slug()).isNotEmpty();
            assertThat(s.closing()).as(s.slug()).isNotBlank();
            assertThat(s.goals().size()).as(s.slug() + " is a real conversation").isGreaterThanOrEqualTo(5);
        }
    }

    /**
     * Every hint must satisfy its own goal and every option must be judged as itself, otherwise
     * a learner who follows the app's own suggestion would be told they got it wrong.
     */
    @Test
    void everySuggestedLinePassesTheScriptedJudge() {
        ScriptedRoleplayModel judge = new ScriptedRoleplayModel();
        for (Scenario s : scenarios()) {
            Map<String, String> facts = new LinkedHashMap<>();
            s.facts().forEach(f -> facts.put(f.id(), f.values().getFirst()));
            List<String> plan = new ArrayList<>();
            s.goals().forEach(g -> plan.add("g:" + g.id()));
            s.twists().forEach(t -> plan.add("t:" + t.id()));
            for (SceneStep step : ScenePlanner.resolve(s, plan, facts, "Ozan")) {
                if (step.twist()) {
                    for (int i = 0; i < step.options().size(); i++) {
                        Reply r = judge.respond(new Context(step, List.of(), step.options().get(i).text(), "Ozan"));
                        assertThat(r.optionIndex()).as(s.slug() + "/" + step.id() + " option " + i).isEqualTo(i);
                    }
                } else {
                    Reply r = judge.respond(new Context(step, List.of(), step.hint(), "Ozan"));
                    assertThat(r.goalMet()).as(s.slug() + "/" + step.id() + " hint").isTrue();
                }
            }
        }
    }

    @Test
    void weeksMapToJourneyDays() {
        assertThat(content.weekForDay(1).level()).isEqualTo("Travel Ready");
        assertThat(content.weekForDay(8).level()).isEqualTo("Travel Confident");
        assertThat(content.weekForDay(21).level()).isEqualTo("Travel Pro");
    }

    @Test
    void placementHasFiveQuestionsAndBands() {
        assertThat(content.placement().questions()).hasSize(5);
        assertThat(content.placement().bands().stream().map(b -> b.startDay()).toList()).containsExactly(1, 8, 15);
    }

    private List<Scenario> scenarios() {
        return content.availableChapters().stream()
            .map(c -> content.scenario(content.chapterMeta(c.slug()).orElseThrow().scenario()).orElseThrow())
            .toList();
    }
}
