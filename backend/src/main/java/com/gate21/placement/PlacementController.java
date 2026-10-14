package com.gate21.placement;

import com.gate21.common.CurrentUser;
import com.gate21.placement.PlacementService.Kind;
import com.gate21.placement.PlacementService.Result;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/placement")
public class PlacementController {

    public record PlacementRequest(
        @NotNull Kind kind,
        @NotNull @Size(max = 20) List<Integer> answers,
        @Size(max = 5) List<Integer> speakingScores) {
    }

    private final PlacementService placement;

    public PlacementController(PlacementService placement) {
        this.placement = placement;
    }

    @PostMapping
    Result submit(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PlacementRequest req) {
        return placement.submit(CurrentUser.id(jwt), req.kind(), req.answers(), req.speakingScores());
    }
}
