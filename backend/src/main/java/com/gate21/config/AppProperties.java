package com.gate21.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("gate21")
public record AppProperties(JwtProps jwt, QuotaProps quota, SpeechProps speech, RoleplayProps roleplay) {

    public record JwtProps(String secret, String issuer, Duration accessTokenTtl, Duration refreshTokenTtl) {
    }

    public record QuotaProps(int speechPerDay, int roleplaySessionsPerDay, int roleplayMaxTurns) {
    }

    public record SpeechProps(String provider, AzureProps azure) {
    }

    public record AzureProps(String key, String region, String language, Duration timeout) {
    }

    public record RoleplayProps(String provider, GeminiProps gemini) {
    }

    public record GeminiProps(String apiKey, String model, String baseUrl, Duration timeout, int maxOutputTokens) {
    }
}
