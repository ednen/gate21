package com.gate21.practice;

import com.gate21.common.CurrentUser;
import com.gate21.practice.PracticeService.Overview;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/practice")
public class PracticeController {

    private final PracticeService practice;

    public PracticeController(PracticeService practice) {
        this.practice = practice;
    }

    @GetMapping
    Overview overview(@AuthenticationPrincipal Jwt jwt) {
        return practice.overview(CurrentUser.id(jwt));
    }

    @PostMapping("/done")
    Overview done(@AuthenticationPrincipal Jwt jwt) {
        return practice.done(CurrentUser.id(jwt));
    }
}
