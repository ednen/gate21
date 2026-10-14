package com.gate21.progress;

import com.gate21.common.CurrentUser;
import com.gate21.progress.ProgressService.AttemptInput;
import com.gate21.progress.ProgressService.PassportChapter;
import com.gate21.progress.ProgressService.SyncResult;
import com.gate21.user.MeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/progress")
public class ProgressController {

    public record AttemptDto(
        @NotNull UUID clientId,
        @NotBlank @Size(max = 40) String chapter,
        @NotNull Step step,
        @Min(0) @Max(100) Integer score,
        Instant occurredAt) {
    }

    public record SyncRequest(@NotNull @Size(min = 1, max = 200) List<@Valid AttemptDto> attempts) {
    }

    public record PassportResponse(String holder, Instant issuedAt, int journeyDay, String level, int stamps,
                                   List<PassportChapter> chapters) {
    }

    private final ProgressService progress;
    private final MeService me;

    public ProgressController(ProgressService progress, MeService me) {
        this.progress = progress;
        this.me = me;
    }

    @PostMapping("/sync")
    SyncResult sync(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SyncRequest req) {
        List<AttemptInput> inputs = req.attempts().stream()
            .map(a -> new AttemptInput(a.clientId(), a.chapter(), a.step(), a.score(), a.occurredAt()))
            .toList();
        return progress.sync(CurrentUser.id(jwt), inputs);
    }

    @GetMapping("/passport")
    PassportResponse passport(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = CurrentUser.id(jwt);
        var summary = me.summary(userId);
        List<PassportChapter> chapters = progress.passport(userId, summary.journeyDay());
        int stamps = (int) chapters.stream().filter(c -> c.stampedAt() != null).count();
        return new PassportResponse(summary.displayName(), summary.memberSince(), summary.journeyDay(),
            summary.level(), stamps, chapters);
    }
}
