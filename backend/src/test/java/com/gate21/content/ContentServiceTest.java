package com.gate21.content;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gate21.content.ContentModels.ChapterInfo;
import org.junit.jupiter.api.Test;

/** Loading the service runs every cross-reference check on the real content packs. */
class ContentServiceTest {

    private final ContentService content = new ContentService(
        JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build());

    @Test
    void everyAvailableChapterHasItsFileMissionAndScenario() {
        assertThat(content.availableChapters().stream().map(ChapterInfo::slug).toList())
            .containsExactly("airport", "hotel", "restaurant", "shopping");
        for (ChapterInfo chapter : content.availableChapters()) {
            var meta = content.chapterMeta(chapter.slug()).orElseThrow();
            assertThat(meta.mission()).isNotBlank();
            assertThat(meta.stamp()).isNotBlank();
            assertThat(content.scenario(meta.scenario())).isPresent();
        }
    }

    @Test
    void everyScenarioEndsWithATwist() {
        for (ChapterInfo chapter : content.availableChapters()) {
            var scenario = content.scenario(content.chapterMeta(chapter.slug()).orElseThrow().scenario()).orElseThrow();
            assertThat(scenario.goals().getLast().twist()).as(scenario.slug()).isTrue();
            assertThat(scenario.goals().getLast().options()).hasSize(3);
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
}
