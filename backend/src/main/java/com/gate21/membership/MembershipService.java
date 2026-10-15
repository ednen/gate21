package com.gate21.membership;

import com.gate21.common.ApiException;
import com.gate21.config.AppProperties;
import com.gate21.config.AppProperties.MembershipProps;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentService;
import com.gate21.membership.MembershipRepository.MembershipRow;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Who may play what. Payment itself happens in the App Store / Google Play; until store
 * receipts are verified here, purchases are only granted in sandbox mode (local and tests).
 */
@Service
public class MembershipService {

    /** {@code plan} is FREE when nothing active. */
    public record Status(String plan, boolean active, Instant expiresAt, int freeDays) {
    }

    public record Offer(String id, String title, String titleTr, String price, String periodTr,
                        List<String> featuresTr) {
    }

    public record Offers(Status current, boolean storeConnected, List<Offer> plans) {
    }

    private final MembershipRepository repo;
    private final ContentService content;
    private final MembershipProps props;
    private final Clock clock;

    public MembershipService(MembershipRepository repo, ContentService content, AppProperties props, Clock clock) {
        this.repo = repo;
        this.content = content;
        this.props = props.membership();
        this.clock = clock;
    }

    public Status status(UUID userId) {
        int freeDays = content.manifest().freeDays();
        return repo.find(userId)
            .filter(m -> m.expiresAt().isAfter(clock.instant()))
            .map(m -> new Status(m.plan().name(), true, m.expiresAt(), freeDays))
            .orElse(new Status("FREE", false, null, freeDays));
    }

    /** The Starter pack and the first free days are open to everyone; the rest needs a plan. */
    public boolean canPlay(UUID userId, ChapterInfo chapter) {
        if (chapter.isStarter() || (chapter.isLesson() && chapter.day() <= content.manifest().freeDays())) {
            return true;
        }
        return status(userId).active();
    }

    public void requirePlay(UUID userId, ChapterInfo chapter) {
        if (!canPlay(userId, chapter)) {
            throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "MEMBERSHIP_REQUIRED",
                "This chapter is part of the full journey.");
        }
    }

    public Offers offers(UUID userId) {
        return new Offers(status(userId), false, List.of(
            new Offer(Plan.JOURNEY.name(), "Gate 21 Journey", "21 günlük yolculuk", props.journeyPrice(),
                "Tek seferlik · 60 gün erişim",
                List.of("21 günün bütün dersleri (Bronz, Gümüş, Altın)", "Her durakta yapay zekâlı sahneler ve raporlar",
                    "Full Trip simülasyonu ve final testi", "Başlangıç paketi ve SOS her zaman ücretsiz")),
            new Offer(Plan.KEEP_READY.name(), "Keep your English travel ready", "İngilizcen seyahate hazır kalsın",
                props.keepReadyPrice(), "Aylık · yolculuğu bitirenlere",
                List.of("Bütün sahneleri yeniden oyna, her seferinde yeni sürprizler", "Raporlarındaki kalıplarla kısa tekrarlar",
                    "Haftada 2 pratik hedefi ve hatırlatmalar", "Yeni şehirler ve bölümler eklendikçe"))));
    }

    /**
     * Grants a plan straight away. Only allowed in sandbox mode: in production the app will send
     * a store receipt to a verify endpoint instead.
     */
    @Transactional
    public Status purchase(UUID userId, Plan plan) {
        if (!props.sandboxPurchases()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "STORE_NOT_CONNECTED",
                "In-app purchases are not connected yet.");
        }
        Instant now = clock.instant();
        Instant from = repo.find(userId)
            .filter(m -> m.plan() == plan && m.expiresAt().isAfter(now))
            .map(MembershipRow::expiresAt)
            .orElse(now);
        repo.upsert(userId, plan, "sandbox", now, from.plus(plan.length()), now);
        return status(userId);
    }
}
