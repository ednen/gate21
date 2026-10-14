package com.gate21.auth;

import com.gate21.auth.TokenService.TokenPair;
import com.gate21.common.ApiException;
import com.gate21.user.UserRepository;
import com.gate21.user.UserRepository.UserRow;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final TokenService tokens;
    private final PasswordEncoder passwordEncoder;
    /** Compared against when the email is unknown, so both paths take the same BCrypt time. */
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, TokenService tokens,
                       PasswordEncoder passwordEncoder) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.tokens = tokens;
        this.passwordEncoder = passwordEncoder;
        this.dummyHash = passwordEncoder.encode("timing-equalizer-" + UUID.randomUUID());
    }

    @Transactional
    public TokenPair register(String email, String password, String displayName, String timezone) {
        String zone = validZone(timezone);
        UserRow user = new UserRow(UUID.randomUUID(), normalize(email), passwordEncoder.encode(password),
            displayName.strip(), zone, 20, null, Instant.now());
        if (!users.insert(user)) {
            throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists.");
        }
        return tokens.issue(user.id());
    }

    @Transactional
    public TokenPair login(String email, String password) {
        UserRow user = users.findByEmail(normalize(email)).orElse(null);
        String hash = user == null ? dummyHash : user.passwordHash();
        boolean matches = passwordEncoder.matches(password, hash);
        if (user == null || !matches) {
            throw ApiException.unauthorized("INVALID_CREDENTIALS", "Email or password is incorrect.");
        }
        return tokens.issue(user.id());
    }

    /**
     * Rotates the refresh token. A token that was already used signals theft, so every
     * session of that user is closed.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken) {
        Instant now = Instant.now();
        var row = refreshTokens.lockByHash(TokenService.hash(refreshToken))
            .orElseThrow(() -> ApiException.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again."));
        if (row.revokedAt() != null) {
            refreshTokens.revokeAllForUser(row.userId(), now);
            throw ApiException.unauthorized("REFRESH_TOKEN_REUSED", "Please sign in again.");
        }
        if (row.expiresAt().isBefore(now)) {
            throw ApiException.unauthorized("INVALID_REFRESH_TOKEN", "Please sign in again.");
        }
        refreshTokens.revoke(row.id(), now);
        return tokens.issue(row.userId());
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokens.lockByHash(TokenService.hash(refreshToken))
            .ifPresent(row -> refreshTokens.revoke(row.id(), Instant.now()));
    }

    static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    public static String validZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return "Europe/Istanbul";
        }
        try {
            return ZoneId.of(timezone).getId();
        } catch (DateTimeException e) {
            throw ApiException.badRequest("INVALID_TIMEZONE", "Unknown time zone " + timezone);
        }
    }
}
