package com.gate21.progress;

import com.gate21.common.ApiException;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.LevelInfo;
import com.gate21.content.ContentService;
import com.gate21.progress.ProgressRepository.ChapterRow;
import com.gate21.progress.ProgressRepository.StatsRow;
import com.gate21.user.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProgressService {

    /** Offline attempts older than this still count, but on this oldest day. */
    static final Duration MAX_OFFLINE_AGE = Duration.ofDays(7);
    /** Tolerated clock skew of the device. */
    static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(5);

    public record AttemptInput(UUID clientId, String chapter, Step step, Integer score, Instant occurredAt) {
    }

    /** {@code levelsEarned}: Bronze/Silver/Gold badges completed by this batch; {@code graduated}: the journey too. */
    public record SyncResult(int accepted, int duplicates, int xpGained, List<String> stampedChapters,
                             List<String> levelsEarned, boolean graduated, int xpTotal, int streak) {
    }

    public record PassportChapter(String slug, String kind, String stop, String title, String titleTr, int week,
                                  int day, int order, String icon, boolean available, boolean unlocked, int stepsDone,
                                  int totalSteps, boolean complete, int stars, String stamp, Instant stampedAt) {
    }

    /** A week's badge: earned when all seven of its lessons are complete. */
    public record LevelBadge(String id, int week, String title, String titleTr, String tagline, String message,
                             String messageTr, String trip, int lessonsDone, int lessons, boolean earned,
                             Instant earnedAt) {
    }

    private final ProgressRepository repo;
    private final UserRepository users;
    private final ContentService content;
    private final Clock clock;

    public ProgressService(ProgressRepository repo, UserRepository users, ContentService content, Clock clock) {
        this.repo = repo;
        this.users = users;
        this.content = content;
        this.clock = clock;
    }

    /**
     * Applies a batch of attempts recorded on the device. The user's stats row is locked for
     * the whole transaction, so concurrent syncs from two devices are applied one after the other.
     */
    @Transactional
    public SyncResult sync(UUID userId, List<AttemptInput> attempts) {
        for (AttemptInput a : attempts) {
            if (!content.isAvailableChapter(a.chapter())) {
                throw ApiException.badRequest("UNKNOWN_CHAPTER", "Unknown chapter " + a.chapter());
            }
        }
        StatsRow stats = repo.lockStats(userId);
        ZoneId zone = ZoneId.of(users.findById(userId).orElseThrow().timezone());
        Instant now = clock.instant();

        int accepted = 0;
        int xpGained = 0;
        int speakingSum = 0;
        int speakingCount = 0;
        Set<String> touchedChapters = new LinkedHashSet<>();

        for (AttemptInput a : attempts) {
            Instant occurred = clamp(a.occurredAt(), now);
            Integer score = a.score() == null ? null : Math.max(0, Math.min(100, a.score()));
            int xp = ProgressRules.xpFor(a.step(), score);
            if (!repo.insertAttempt(userId, a.clientId(), a.chapter(), a.step(), score, xp, occurred, now)) {
                continue;
            }
            accepted++;
            xpGained += xp;
            if (score != null) {
                speakingSum += score;
                speakingCount++;
            }
            repo.addDailyXp(userId, occurred.atZone(zone).toLocalDate(), xp);
            repo.applyStep(userId, a.chapter(), a.step(), score);
            touchedChapters.add(a.chapter());
        }

        List<String> stamped = new ArrayList<>();
        List<String> levelsEarned = new ArrayList<>();
        boolean graduated = false;
        if (accepted > 0) {
            Map<String, ChapterRow> rows = rows(userId);
            for (String slug : touchedChapters) {
                ChapterRow row = rows.get(slug);
                if (row != null && row.complete(requiredBits(slug))) {
                    if (row.stampedAt() == null) {
                        stamped.add(slug);
                    }
                    repo.stamp(userId, slug, ProgressRules.stars(row.averageScore()), now);
                }
            }
            for (LevelInfo level : content.manifest().levels()) {
                boolean touched = touchedChapters.stream()
                    .anyMatch(slug -> content.chapterInfo(slug).map(c -> c.isLesson() && c.week() == level.week()).orElse(false));
                if (touched && newlyCompleted(level.week(), rows, touchedChapters)) {
                    levelsEarned.add(level.id());
                }
            }
            if (stats.graduatedAt() == null && journeyComplete(rows)) {
                repo.setGraduated(userId, now);
                graduated = true;
            }
        }

        List<LocalDate> active = repo.activeDaysNewestFirst(userId, 400);
        int streak = ProgressRules.runLength(active);
        LocalDate lastActive = active.isEmpty() ? null : active.getFirst();
        int best = Math.max(stats.streakBest(), streak);
        repo.saveStats(userId, xpGained, streak, best, lastActive, speakingSum, speakingCount);

        LocalDate today = LocalDate.now(clock.withZone(zone));
        return new SyncResult(accepted, attempts.size() - accepted, xpGained, stamped, levelsEarned, graduated,
            stats.xpTotal() + xpGained, ProgressRules.effectiveStreak(streak, lastActive, today));
    }

    public List<PassportChapter> passport(UUID userId, int journeyDay) {
        Map<String, ChapterRow> rows = rows(userId);
        List<PassportChapter> result = new ArrayList<>();
        for (ChapterInfo c : content.manifest().chapters()) {
            ChapterRow row = rows.get(c.slug());
            int required = requiredBits(c.slug());
            String stamp = content.chapterMeta(c.slug()).map(m -> m.stamp()).orElse(null);
            result.add(new PassportChapter(
                c.slug(), c.kind(), c.stop(), c.title(), c.titleTr(), c.week(), c.day(), c.order(), c.icon(),
                c.available(),
                unlocked(c, journeyDay, rows),
                row == null ? 0 : Integer.bitCount(row.stepsDone() & required),
                Integer.bitCount(required),
                complete(c, rows),
                row == null ? 0 : row.stars(),
                stamp,
                row == null ? null : row.stampedAt()));
        }
        return result;
    }

    public List<LevelBadge> levels(UUID userId) {
        Map<String, ChapterRow> rows = rows(userId);
        List<LevelBadge> result = new ArrayList<>();
        for (LevelInfo level : content.manifest().levels()) {
            List<ChapterInfo> lessons = content.lessonsOfWeek(level.week());
            int done = (int) lessons.stream().filter(c -> complete(c, rows)).count();
            boolean earned = weekComplete(level.week(), rows);
            Instant earnedAt = earned
                ? lessons.stream().map(c -> rows.get(c.slug()).stampedAt()).filter(java.util.Objects::nonNull)
                    .max(Instant::compareTo).orElse(null)
                : null;
            result.add(new LevelBadge(level.id(), level.week(), level.title(), level.titleTr(), level.tagline(),
                level.message(), level.messageTr(), level.trip(), done, lessons.size(), earned, earnedAt));
        }
        return result;
    }

    /**
     * Today's mission. Learners who were advised to start from zero get the Starter pack first;
     * then the first unfinished, unlocked chapter of the week they started in or later, and
     * failing that, anything unfinished they skipped. Null when everything unlocked is done.
     */
    public ChapterInfo nextChapter(UUID userId, int journeyDay, int startDay, boolean starterFirst) {
        Map<String, ChapterRow> rows = rows(userId);
        if (starterFirst) {
            for (ChapterInfo c : content.starterChapters()) {
                if (!complete(c, rows)) {
                    return c;
                }
            }
        }
        int startWeek = content.levelForDay(startDay).week();
        ChapterInfo skipped = null;
        for (ChapterInfo c : content.availableChapters()) {
            if (c.isStarter() || complete(c, rows) || !unlocked(c, journeyDay, rows)) {
                continue;
            }
            if (c.week() >= startWeek) {
                return c;
            }
            if (skipped == null) {
                skipped = c;
            }
        }
        return skipped;
    }

    /** When the last Starter lesson was finished, if all of them are. */
    public java.util.Optional<Instant> starterFinishedAt(UUID userId) {
        Map<String, ChapterRow> rows = rows(userId);
        List<ChapterInfo> starter = content.starterChapters();
        if (starter.isEmpty() || !starter.stream().allMatch(c -> complete(c, rows))) {
            return java.util.Optional.empty();
        }
        return starter.stream().map(c -> rows.get(c.slug()).stampedAt()).filter(java.util.Objects::nonNull)
            .max(Instant::compareTo);
    }

    /**
     * Starter lessons are always open. A week opens on its first journey day, or as soon as the
     * week before it is finished, so a fast learner never waits for the calendar.
     */
    boolean unlocked(ChapterInfo c, int journeyDay, Map<String, ChapterRow> rows) {
        if (!c.available()) {
            return false;
        }
        if (c.isStarter() || c.week() <= 1) {
            return true;
        }
        return journeyDay >= content.level(c.week()).startDay() || weekComplete(c.week() - 1, rows);
    }

    /** All seven lessons of the week exist, are available and are complete. */
    boolean weekComplete(int week, Map<String, ChapterRow> rows) {
        List<ChapterInfo> lessons = content.lessonsOfWeek(week);
        return lessons.size() == 7 && lessons.stream().allMatch(c -> c.available() && complete(c, rows));
    }

    private boolean newlyCompleted(int week, Map<String, ChapterRow> rows, Set<String> touched) {
        if (!weekComplete(week, rows)) {
            return false;
        }
        // Newly complete when one of the touched lessons got its stamp in this batch.
        return content.lessonsOfWeek(week).stream()
            .anyMatch(c -> touched.contains(c.slug()) && rows.get(c.slug()).stampedAt() == null);
    }

    private boolean journeyComplete(Map<String, ChapterRow> rows) {
        return content.manifest().levels().stream().allMatch(l -> weekComplete(l.week(), rows));
    }

    private boolean complete(ChapterInfo c, Map<String, ChapterRow> rows) {
        ChapterRow row = rows.get(c.slug());
        return row != null && c.available() && row.complete(requiredBits(c.slug()));
    }

    private Map<String, ChapterRow> rows(UUID userId) {
        return repo.chapters(userId).stream().collect(Collectors.toMap(ChapterRow::chapterSlug, Function.identity()));
    }

    /** The chapter's own steps; chapters that are not out yet need every step there is. */
    int requiredBits(String slug) {
        return content.chapterMeta(slug).map(m -> m.requiredBits()).orElse((1 << Step.values().length) - 1);
    }

    static Instant clamp(Instant occurredAt, Instant now) {
        if (occurredAt == null || occurredAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
            return now;
        }
        Instant oldest = now.minus(MAX_OFFLINE_AGE);
        return occurredAt.isBefore(oldest) ? oldest : occurredAt;
    }
}
