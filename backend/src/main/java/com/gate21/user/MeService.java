package com.gate21.user;

import com.gate21.auth.AuthService;
import com.gate21.common.ApiException;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.LevelInfo;
import com.gate21.membership.MembershipService;
import com.gate21.membership.MembershipService.Status;
import com.gate21.content.ContentService;
import com.gate21.progress.ProgressRepository;
import com.gate21.progress.ProgressRepository.StatsRow;
import com.gate21.progress.ProgressRules;
import com.gate21.progress.ProgressService;
import com.gate21.user.UserRepository.UserRow;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeService {

    public record NextChapter(String slug, String kind, String stop, int week, int day, String title, String titleTr,
                              String mission, String missionTr, String scenario) {
    }

    /** "Keep your English travel ready": practise on at least two days a week. */
    public record Practice(int thisWeek, int weeklyGoal) {
    }

    public record Summary(UUID id, String email, String displayName, String timezone, int reminderHour,
                          boolean voiceConsent, Instant memberSince, int journeyDay, int week, String levelId,
                          String level, String levelTr, String trip, boolean todayDone, int todayXp, int dailyGoalXp,
                          int streak, int streakBest, int xp, Integer speakingAccuracy, Integer placementScore,
                          Integer finalScore, boolean starterRecommended, boolean starterDone, Instant graduatedAt,
                          Practice practice, Status membership, NextChapter nextChapter) {
    }

    private final UserRepository users;
    private final ProgressRepository progressRepo;
    private final ProgressService progress;
    private final ContentService content;
    private final MembershipService membership;
    private final Clock clock;

    public MeService(UserRepository users, ProgressRepository progressRepo, ProgressService progress,
                     ContentService content, MembershipService membership, Clock clock) {
        this.users = users;
        this.progressRepo = progressRepo;
        this.progress = progress;
        this.content = content;
        this.membership = membership;
        this.clock = clock;
    }

    public Summary summary(UUID userId) {
        UserRow user = users.findById(userId)
            .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Please sign in again."));
        StatsRow stats = progressRepo.stats(userId).orElseThrow();
        ZoneId zone = ZoneId.of(user.timezone());
        LocalDate today = LocalDate.now(clock.withZone(zone));
        Optional<Instant> starterFinished = progress.starterFinishedAt(userId);
        boolean starterDone = starterFinished.isPresent();
        boolean starterFirst = stats.starterRecommended() && !starterDone;
        // Days spent on the Starter pack do not use up the 21-day journey.
        int activeDays;
        if (starterFirst) {
            activeDays = 0;
        } else if (stats.starterRecommended()) {
            activeDays = progressRepo.activeDaysBetween(userId, starterFinished.get().atZone(zone).toLocalDate(), today);
        } else {
            activeDays = progressRepo.activeDaysBefore(userId, today);
        }
        int journeyDay = ProgressRules.journeyDay(stats.startDay(), activeDays);
        LevelInfo level = content.levelForDay(journeyDay);
        int todayXp = progressRepo.xpOn(userId, today);

        ChapterInfo next = progress.nextChapter(userId, journeyDay, stats.startDay(), starterFirst);
        NextChapter nextChapter = next == null ? null : content.chapterMeta(next.slug())
            .map(m -> new NextChapter(next.slug(), next.kind(), next.stop(), next.week(), next.day(), next.title(),
                next.titleTr(), m.mission(), m.missionTr(), m.scenario()))
            .orElse(null);

        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int practiceDays = progressRepo.practiceDays(userId, monday, monday.plusDays(6)).size();

        return new Summary(user.id(), user.email(), user.displayName(), user.timezone(), user.reminderHour(),
            user.voiceConsentAt() != null, user.createdAt(), journeyDay, level.week(), level.id(), level.title(),
            level.titleTr(), level.trip(), todayXp >= ProgressRules.DAILY_GOAL_XP, todayXp, ProgressRules.DAILY_GOAL_XP,
            ProgressRules.effectiveStreak(stats.streakCurrent(), stats.lastActiveDate(), today),
            stats.streakBest(), stats.xpTotal(), stats.speakingAverage(), stats.placementScore(),
            stats.finalScore(), stats.starterRecommended(), starterDone, stats.graduatedAt(),
            new Practice(practiceDays, ProgressRules.PRACTICE_DAYS_PER_WEEK), membership.status(userId), nextChapter);
    }

    @Transactional
    public Summary update(UUID userId, String displayName, String timezone, Integer reminderHour, Boolean voiceConsent) {
        UserRow user = users.findById(userId)
            .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Please sign in again."));
        users.updateProfile(userId,
            displayName == null ? user.displayName() : displayName.strip(),
            timezone == null ? user.timezone() : AuthService.validZone(timezone),
            reminderHour == null ? user.reminderHour() : reminderHour);
        if (voiceConsent != null) {
            users.setVoiceConsent(userId, voiceConsent ? clock.instant() : null);
        }
        return summary(userId);
    }

    @Transactional
    public void delete(UUID userId) {
        users.delete(userId);
    }
}
