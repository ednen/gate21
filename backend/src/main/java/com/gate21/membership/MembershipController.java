package com.gate21.membership;

import com.gate21.common.CurrentUser;
import com.gate21.membership.MembershipService.Offers;
import com.gate21.membership.MembershipService.Status;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/membership")
public class MembershipController {

    public record PurchaseRequest(@NotNull Plan plan) {
    }

    private final MembershipService membership;

    public MembershipController(MembershipService membership) {
        this.membership = membership;
    }

    @GetMapping
    Offers offers(@AuthenticationPrincipal Jwt jwt) {
        return membership.offers(CurrentUser.id(jwt));
    }

    @PostMapping("/purchase")
    Status purchase(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PurchaseRequest req) {
        return membership.purchase(CurrentUser.id(jwt), req.plan());
    }
}
