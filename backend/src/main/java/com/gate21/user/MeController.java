package com.gate21.user;

import com.gate21.common.CurrentUser;
import com.gate21.user.MeService.Summary;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
public class MeController {

    public record UpdateRequest(
        @Size(min = 1, max = 60) String displayName,
        @Size(max = 64) String timezone,
        @Min(0) @Max(23) Integer reminderHour,
        Boolean voiceConsent) {
    }

    private final MeService me;

    public MeController(MeService me) {
        this.me = me;
    }

    @GetMapping
    Summary get(@AuthenticationPrincipal Jwt jwt) {
        return me.summary(CurrentUser.id(jwt));
    }

    @PatchMapping
    Summary update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateRequest req) {
        return me.update(CurrentUser.id(jwt), req.displayName(), req.timezone(), req.reminderHour(), req.voiceConsent());
    }

    /** Permanently deletes the account and all its data (KVKK / App Store requirement). */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt) {
        me.delete(CurrentUser.id(jwt));
    }
}
