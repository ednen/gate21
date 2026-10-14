package com.gate21.auth;

import com.gate21.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Issues short-lived access tokens (JWT) and opaque refresh tokens. Only the SHA-256 of a
 * refresh token is stored. Token timestamps use the wall clock, not the injectable business
 * clock, because the JWT validator checks expiry against the wall clock.
 */
@Service
public class TokenService {

    public record TokenPair(String accessToken, String refreshToken, long expiresIn) {
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JwtEncoder encoder;
    private final RefreshTokenRepository refreshTokens;
    private final AppProperties props;

    public TokenService(JwtEncoder encoder, RefreshTokenRepository refreshTokens, AppProperties props) {
        this.encoder = encoder;
        this.refreshTokens = refreshTokens;
        this.props = props;
    }

    public TokenPair issue(UUID userId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(props.jwt().issuer())
            .subject(userId.toString())
            .issuedAt(now)
            .expiresAt(now.plus(props.jwt().accessTokenTtl()))
            .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String access = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        refreshTokens.insert(userId, hash(refresh), now.plus(props.jwt().refreshTokenTtl()), now);

        return new TokenPair(access, refresh, props.jwt().accessTokenTtl().toSeconds());
    }

    public static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
