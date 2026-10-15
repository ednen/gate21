package com.gate21.content;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.progress.Step;
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
    void theJourneyIsSevenStopsAtThreeLevels() {
        assertThat(content.manifest().stops()).hasSize(7);
        for (int week = 1; week <= 3; week++) {
            List<ChapterInfo> lessons = content.lessonsOfWeek(week);
            assertThat(lessons).hasSize(7);
            assertThat(lessons.stream().map(ChapterInfo::day).toList())
                .containsExactly(week * 7 - 6, week * 7 - 5, week * 7 - 4, week * 7 - 3, week * 7 - 2, week * 7 - 1, week * 7);
        }
        assertThat(content.lessonsOfWeek(1)).allMatch(ChapterInfo::available);
        assertThat(content.lessonsOfWeek(2)).allMatch(ChapterInfo::available);
        assertThat(content.hasAvailableLessons(3)).isFalse();
    }

    @Test
    void everyAvailableChapterHasItsMissionAndItsOwnSteps() {
        assertThat(content.availableChapters().stream().map(ChapterInfo::slug).toList()).containsExactly(
            "starter-alphabet", "starter-numbers", "starter-spelling", "starter-people", "starter-basics",
            "arrival-bronze", "transfer-bronze", "hotel-bronze", "restaurant-bronze", "cafe-bronze",
            "shopping-bronze", "transport-bronze",
            "arrival-silver", "transfer-silver", "hotel-silver", "restaurant-silver", "cafe-silver",
            "shopping-silver", "transport-silver", "full-trip");
        for (ChapterInfo chapter : content.availableChapters()) {
            var meta = content.chapterMeta(chapter.slug()).orElseThrow();
            assertThat(meta.mission()).as(chapter.slug()).isNotBlank();
            assertThat(meta.stamp()).as(chapter.slug()).isNotBlank();
            assertThat(meta.scenario() != null).as(chapter.slug() + " has a scene").isEqualTo(!chapter.isStarter());
            if (meta.scenario() != null) {
                assertThat(content.scenario(meta.scenario())).isPresent();
            }
        }
        assertThat(content.chapterMeta("full-trip").orElseThrow().requiredBits()).isEqualTo(Step.SURVIVE.bit());
        assertThat(content.chapterMeta("arrival-bronze").orElseThrow().requiredBits() & Step.FORM.bit()).isNotZero();
        assertThat(content.chapterMeta("starter-alphabet").orElseThrow().requiredBits() & Step.SURVIVE.bit()).isZero();
    }

    @Test
    void aLessonMustEndWithItsScene() {
        ChapterInfo lesson = content.chapterInfo("hotel-bronze").orElseThrow();
        assertThatThrownBy(() -> ContentService.validateSteps(lesson, List.of(Step.SURVIVE, Step.DISCOVER)))
            .hasMessageContaining("ends with its Survive scene");
        ChapterInfo starter = content.chapterInfo("starter-basics").orElseThrow();
        assertThatThrownBy(() -> ContentService.validateSteps(starter, List.of(Step.DISCOVER, Step.SURVIVE)))
            .hasMessageContaining("no scene");
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
    void levelsMapToJourneyDays() {
        assertThat(content.levelForDay(1).id()).isEqualTo("BRONZE");
        assertThat(content.levelForDay(8).title()).isEqualTo("Silver Traveller");
        assertThat(content.levelForDay(21).id()).isEqualTo("GOLD");
        assertThat(content.manifest().graduation().lines()).hasSize(3);
    }

    @Test
    void placementHasFiveQuestionsAndAStarterBand() {
        assertThat(content.placement().questions()).hasSize(5);
        assertThat(content.placement().bands().getFirst().starter()).isTrue();
        assertThat(content.placement().bands().stream().map(b -> b.startDay()).toList()).containsExactly(1, 1, 8, 15);
    }

    private List<Scenario> scenarios() {
        return content.availableChapters().stream()
            .map(c -> content.chapterMeta(c.slug()).orElseThrow().scenario())
            .filter(slug -> slug != null)
            .map(slug -> content.scenario(slug).orElseThrow())
            .toList();
    }
}
