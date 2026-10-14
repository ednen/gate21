package com.gate21.user;

import com.gate21.auth.AuthService;
import com.gate21.common.ApiException;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.WeekInfo;
import com.gate21.content.ContentService;
import com.gate21.progress.ProgressRepository;
import com.gate21.progress.ProgressRepository.StatsRow;
import com.gate21.progress.ProgressRules;
import com.gate21.progress.ProgressService;
import com.gate21.user.UserRepository.UserRow;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeService {

    public record NextChapter(String slug, String title, String titleTr, String mission, String missionTr,
                              String scenario) {
    }

    public record Summary(UUID id, String email, String displayName, String timezone, int reminderHour,
                          boolean voiceConsent, Instant memberSince, int journeyDay, int week, String level,
                          String levelTr, boolean todayDone, int todayXp, int dailyGoalXp, int streak,
                          int streakBest, int xp, Integer speakingAccuracy, Integer placementScore,
                          Integer finalScore, NextChapter nextChapter) {
    }

    private final UserRepository users;
    private final ProgressRepository progressRepo;
    private final ProgressService progress;
    private final ContentService content;
    private final Clock clock;

    public MeService(UserRepository users, ProgressRepository progressRepo, ProgressService progress,
                     ContentService content, Clock clock) {
        this.users = users;
        this.progressRepo = progressRepo;
        this.progress = progress;
        this.content = content;
        this.clock = clock;
    }

    public Summary summary(UUID userId) {
        UserRow user = users.findById(userId)
            .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Please sign in again."));
        StatsRow stats = progressRepo.stats(userId).orElseThrow();
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of(user.timezone())));

        int journeyDay = ProgressRules.journeyDay(stats.startDay(), progressRepo.activeDaysBefore(userId, today));
        WeekInfo week = content.weekForDay(journeyDay);
        int todayXp = progressRepo.xpOn(userId, today);

        ChapterInfo next = progress.nextChapter(userId);
        NextChapter nextChapter = next == null ? null : content.chapterMeta(next.slug())
            .map(m -> new NextChapter(next.slug(), next.title(), next.titleTr(), m.mission(), m.missionTr(), m.scenario()))
            .orElse(null);

        return new Summary(user.id(), user.email(), user.displayName(), user.timezone(), user.reminderHour(),
            user.voiceConsentAt() != null, user.createdAt(), journeyDay, week.week(), week.level(), week.levelTr(),
            todayXp >= ProgressRules.DAILY_GOAL_XP, todayXp, ProgressRules.DAILY_GOAL_XP,
            ProgressRules.effectiveStreak(stats.streakCurrent(), stats.lastActiveDate(), today),
            stats.streakBest(), stats.xpTotal(), stats.speakingAverage(), stats.placementScore(),
            stats.finalScore(), nextChapter);
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
