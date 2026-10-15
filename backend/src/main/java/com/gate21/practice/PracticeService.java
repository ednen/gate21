package com.gate21.practice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.common.ApiException;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentService;
import com.gate21.membership.MembershipService;
import com.gate21.progress.ProgressRepository;
import com.gate21.progress.ProgressRepository.ChapterRow;
import com.gate21.progress.ProgressRules;
import com.gate21.roleplay.RoleplayRepository;
import com.gate21.user.UserRepository;
import java.io.IOException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Keep your English travel ready": after the journey, short practice on at least two days a
 * week — phrases from the learner's own scene reports and replays of finished scenes.
 */
@Service
public class PracticeService {

    static final int PHRASE_LIMIT = 20;
    /** XP for one short practice session; enough to count the day as a practice day. */
    static final int PRACTICE_XP = 20;

    public record Phrase(String en, String tr) {
    }

    public record Scene(String chapter, String scenario, String title, String titleTr, String icon, int week) {
    }

    public record Overview(int weeklyGoal, List<LocalDate> practiceDays, int thisWeek, List<Phrase> phrases,
                           List<Scene> scenes) {
    }

    private final ProgressRepository progress;
    private final RoleplayRepository roleplay;
    private final UserRepository users;
    private final ContentService content;
    private final MembershipService membership;
    private final ObjectMapper mapper;
    private final Clock clock;

    public PracticeService(ProgressRepository progress, RoleplayRepository roleplay, UserRepository users,
                           ContentService content, MembershipService membership, ObjectMapper mapper, Clock clock) {
        this.progress = progress;
        this.roleplay = roleplay;
        this.users = users;
        this.content = content;
        this.membership = membership;
        this.mapper = mapper;
        this.clock = clock;
    }

    public Overview overview(UUID userId) {
        LocalDate today = today(userId);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<LocalDate> days = progress.practiceDays(userId, monday, monday.plusDays(6));

        Set<String> finished = progress.chapters(userId).stream()
            .filter(r -> r.stampedAt() != null)
            .map(ChapterRow::chapterSlug)
            .collect(Collectors.toSet());
        List<Scene> scenes = new ArrayList<>();
        for (ChapterInfo c : content.availableChapters()) {
            if (!finished.contains(c.slug())) {
                continue;
            }
            content.chapterMeta(c.slug())
                .filter(m -> m.scenario() != null)
                .ifPresent(m -> scenes.add(new Scene(c.slug(), m.scenario(), c.title(), c.titleTr(), c.icon(), c.week())));
        }
        return new Overview(ProgressRules.PRACTICE_DAYS_PER_WEEK, days, days.size(), phrases(userId), scenes);
    }

    /** Records a finished phrase review as today's practice. Needs an active plan. */
    @Transactional
    public Overview done(UUID userId) {
        if (!membership.status(userId).active()) {
            throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "MEMBERSHIP_REQUIRED", "Practice tools need a plan.");
        }
        progress.lockStats(userId);
        progress.addDailyXp(userId, today(userId), PRACTICE_XP);
        return overview(userId);
    }

    /** Distinct "use this next time" phrases from the newest reports, newest first. */
    List<Phrase> phrases(UUID userId) {
        Map<String, Phrase> unique = new LinkedHashMap<>();
        for (String json : roleplay.recentReports(userId, 30)) {
            try {
                for (JsonNode p : mapper.readTree(json).path("phrases")) {
                    String en = p.path("en").asText("");
                    if (!en.isBlank() && unique.size() < PHRASE_LIMIT) {
                        unique.putIfAbsent(en.toLowerCase(java.util.Locale.ROOT), new Phrase(en, p.path("tr").asText("")));
                    }
                }
            } catch (IOException e) {
                // A report that cannot be read simply contributes no phrases.
            }
        }
        return List.copyOf(unique.values());
    }

    private LocalDate today(UUID userId) {
        String zone = users.findById(userId).map(u -> u.timezone()).orElse("Europe/Istanbul");
        return LocalDate.now(clock.withZone(ZoneId.of(zone)));
    }
}
