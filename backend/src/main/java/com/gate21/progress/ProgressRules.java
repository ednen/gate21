package com.gate21.progress;

import java.time.LocalDate;
import java.util.List;

/** Pure game rules: XP, daily goal, streak and stars. Kept free of I/O so they are unit-tested directly. */
public final class ProgressRules {

    /** XP a learner needs in one local day for the day to count towards the streak and journey. */
    public static final int DAILY_GOAL_XP = 50;
    public static final int JOURNEY_DAYS = 21;

    private ProgressRules() {
    }

    public static int xpFor(Step step, Integer score) {
        int base = step == Step.SURVIVE ? 50 : 10;
        int bonus = score != null && score >= 80 ? 5 : 0;
        return base + bonus;
    }

    /** Stars for a finished chapter from its average speaking score (null when nothing was scored). */
    public static int stars(Integer averageScore) {
        if (averageScore == null) {
            return 1;
        }
        if (averageScore >= 85) {
            return 3;
        }
        if (averageScore >= 70) {
            return 2;
        }
        return 1;
    }

    /** Length of the run of consecutive days at the head of a list of active dates sorted newest first. */
    public static int runLength(List<LocalDate> activeDatesNewestFirst) {
        if (activeDatesNewestFirst.isEmpty()) {
            return 0;
        }
        int run = 1;
        for (int i = 1; i < activeDatesNewestFirst.size(); i++) {
            LocalDate newer = activeDatesNewestFirst.get(i - 1);
            LocalDate older = activeDatesNewestFirst.get(i);
            if (older.plusDays(1).equals(newer)) {
                run++;
            } else {
                break;
            }
        }
        return run;
    }

    /** A stored streak only counts while its last active day is today or yesterday. */
    public static int effectiveStreak(int storedStreak, LocalDate lastActiveDate, LocalDate today) {
        if (lastActiveDate == null || lastActiveDate.isBefore(today.minusDays(1))) {
            return 0;
        }
        return storedStreak;
    }

    /** Journey day advances with completed days, not the calendar, so a missed day never skips content. */
    public static int journeyDay(int startDay, int activeDaysBeforeToday) {
        return Math.min(JOURNEY_DAYS, Math.max(1, startDay) + activeDaysBeforeToday);
    }
}
