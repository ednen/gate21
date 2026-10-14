package com.gate21.progress;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProgressRulesTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);

    @Test
    void xpRewardsSurviveAndGoodPronunciation() {
        assertThat(ProgressRules.xpFor(Step.DISCOVER, null)).isEqualTo(10);
        assertThat(ProgressRules.xpFor(Step.PRONOUNCE, 79)).isEqualTo(10);
        assertThat(ProgressRules.xpFor(Step.PRONOUNCE, 80)).isEqualTo(15);
        assertThat(ProgressRules.xpFor(Step.SURVIVE, 90)).isEqualTo(55);
    }

    @Test
    void starsFollowAverageScore() {
        assertThat(ProgressRules.stars(null)).isEqualTo(1);
        assertThat(ProgressRules.stars(69)).isEqualTo(1);
        assertThat(ProgressRules.stars(70)).isEqualTo(2);
        assertThat(ProgressRules.stars(85)).isEqualTo(3);
    }

    @Test
    void runLengthCountsOnlyTheNewestConsecutiveDays() {
        assertThat(ProgressRules.runLength(List.of())).isZero();
        assertThat(ProgressRules.runLength(List.of(TODAY, TODAY.minusDays(1), TODAY.minusDays(2)))).isEqualTo(3);
        assertThat(ProgressRules.runLength(List.of(TODAY, TODAY.minusDays(1), TODAY.minusDays(3)))).isEqualTo(2);
    }

    @Test
    void streakBreaksAfterAMissedDay() {
        assertThat(ProgressRules.effectiveStreak(5, TODAY, TODAY)).isEqualTo(5);
        assertThat(ProgressRules.effectiveStreak(5, TODAY.minusDays(1), TODAY)).isEqualTo(5);
        assertThat(ProgressRules.effectiveStreak(5, TODAY.minusDays(2), TODAY)).isZero();
        assertThat(ProgressRules.effectiveStreak(0, null, TODAY)).isZero();
    }

    @Test
    void journeyDayAdvancesWithCompletedDaysAndStopsAt21() {
        assertThat(ProgressRules.journeyDay(1, 0)).isEqualTo(1);
        assertThat(ProgressRules.journeyDay(1, 7)).isEqualTo(8);
        assertThat(ProgressRules.journeyDay(15, 30)).isEqualTo(21);
    }

    @Test
    void offlineTimestampsAreClampedToAPlausibleWindow() {
        Instant now = Instant.parse("2026-10-14T12:00:00Z");
        assertThat(ProgressService.clamp(null, now)).isEqualTo(now);
        assertThat(ProgressService.clamp(now.plusSeconds(3600), now)).isEqualTo(now);
        assertThat(ProgressService.clamp(now.minusSeconds(60), now)).isEqualTo(now.minusSeconds(60));
        assertThat(ProgressService.clamp(Instant.parse("2026-01-01T00:00:00Z"), now))
            .isEqualTo(now.minus(ProgressService.MAX_OFFLINE_AGE));
    }

    @Test
    void stepBitsCoverSixSteps() {
        assertThat(Step.ALL_BITS).isEqualTo(0b111111);
        assertThat(Step.SURVIVE.bit()).isEqualTo(0b100000);
    }
}
