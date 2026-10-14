package com.gate21.auth;

import com.gate21.auth.TokenService.TokenPair;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    public record RegisterRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 72, message = "Password must be 8–72 characters") String password,
        @NotBlank @Size(max = 60) String displayName,
        @Size(max = 64) String timezone) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    private final AuthService auth;
    private final LoginRateLimiter rateLimiter;

    public AuthController(AuthService auth, LoginRateLimiter rateLimiter) {
        this.auth = auth;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    TokenPair register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http) {
        rateLimiter.check(http.getRemoteAddr(), "register");
        return auth.register(req.email(), req.password(), req.displayName(), req.timezone());
    }

    @PostMapping("/login")
    TokenPair login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        rateLimiter.check(http.getRemoteAddr(), AuthService.normalize(req.email()));
        return auth.login(req.email(), req.password());
    }

    @PostMapping("/refresh")
    TokenPair refresh(@Valid @RequestBody RefreshRequest req) {
        return auth.refresh(req.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(@Valid @RequestBody RefreshRequest req) {
        auth.logout(req.refreshToken());
    }
}
