package com.gate21.progress;

import com.gate21.common.ApiException;
import com.gate21.content.ContentModels.ChapterInfo;
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

    public record SyncResult(int accepted, int duplicates, int xpGained, List<String> stampedChapters,
                             int xpTotal, int streak) {
    }

    public record PassportChapter(String slug, String title, String titleTr, int week, int order, String icon,
                                  boolean available, boolean unlocked, int stepsDone, boolean complete, int stars,
                                  String stamp, Instant stampedAt) {
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
        if (accepted > 0) {
            Map<String, ChapterRow> rows = repo.chapters(userId).stream()
                .collect(Collectors.toMap(ChapterRow::chapterSlug, Function.identity()));
            for (String slug : touchedChapters) {
                ChapterRow row = rows.get(slug);
                if (row != null && row.complete()) {
                    if (row.stampedAt() == null) {
                        stamped.add(slug);
                    }
                    repo.stamp(userId, slug, ProgressRules.stars(row.averageScore()), now);
                }
            }
        }

        List<LocalDate> active = repo.activeDaysNewestFirst(userId, 400);
        int streak = ProgressRules.runLength(active);
        LocalDate lastActive = active.isEmpty() ? null : active.getFirst();
        int best = Math.max(stats.streakBest(), streak);
        repo.saveStats(userId, xpGained, streak, best, lastActive, speakingSum, speakingCount);

        LocalDate today = LocalDate.now(clock.withZone(zone));
        return new SyncResult(accepted, attempts.size() - accepted, xpGained, stamped,
            stats.xpTotal() + xpGained, ProgressRules.effectiveStreak(streak, lastActive, today));
    }

    public List<PassportChapter> passport(UUID userId, int journeyDay) {
        Map<String, ChapterRow> rows = repo.chapters(userId).stream()
            .collect(Collectors.toMap(ChapterRow::chapterSlug, Function.identity()));
        List<PassportChapter> result = new ArrayList<>();
        for (ChapterInfo c : content.manifest().chapters()) {
            ChapterRow row = rows.get(c.slug());
            int weekStart = content.manifest().weeks().stream()
                .filter(w -> w.week() == c.week()).findFirst().map(w -> w.startDay()).orElse(1);
            String stamp = content.chapterMeta(c.slug()).map(m -> m.stamp()).orElse(null);
            result.add(new PassportChapter(
                c.slug(), c.title(), c.titleTr(), c.week(), c.order(), c.icon(),
                c.available(),
                c.available() && journeyDay >= weekStart,
                row == null ? 0 : Integer.bitCount(row.stepsDone() & Step.ALL_BITS),
                row != null && row.complete(),
                row == null ? 0 : row.stars(),
                stamp,
                row == null ? null : row.stampedAt()));
        }
        return result;
    }

    /** The first available chapter that is not finished yet, or null when everything available is done. */
    public ChapterInfo nextChapter(UUID userId) {
        Map<String, ChapterRow> rows = repo.chapters(userId).stream()
            .collect(Collectors.toMap(ChapterRow::chapterSlug, Function.identity()));
        for (ChapterInfo c : content.availableChapters()) {
            ChapterRow row = rows.get(c.slug());
            if (row == null || !row.complete()) {
                return c;
            }
        }
        return null;
    }

    static Instant clamp(Instant occurredAt, Instant now) {
        if (occurredAt == null || occurredAt.isAfter(now.plus(MAX_FUTURE_SKEW))) {
            return now;
        }
        Instant oldest = now.minus(MAX_OFFLINE_AGE);
        return occurredAt.isBefore(oldest) ? oldest : occurredAt;
    }
}
