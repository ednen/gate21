package com.gate21.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fasterxml.jackson.databind.JsonNode;
import com.gate21.IntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AuthIT extends IntegrationTest {

    @Test
    void registeredUserStartsOnDayOneAtPassportControl() throws Exception {
        String token = token("Ozan");
        Response me = getJson("/api/v1/me", token);

        assertThat(me.status()).isEqualTo(200);
        assertThat(me.body().path("displayName").asText()).isEqualTo("Ozan");
        assertThat(me.body().path("journeyDay").asInt()).isEqualTo(1);
        assertThat(me.body().path("level").asText()).isEqualTo("Bronze Traveller");
        assertThat(me.body().path("levelId").asText()).isEqualTo("BRONZE");
        assertThat(me.body().path("membership").path("plan").asText()).isEqualTo("FREE");
        assertThat(me.body().path("streak").asInt()).isZero();
        assertThat(me.body().path("voiceConsent").asBoolean()).isFalse();
        assertThat(me.body().path("nextChapter").path("slug").asText()).isEqualTo("arrival-bronze");
    }

    @Test
    void apiRejectsRequestsWithoutAToken() throws Exception {
        assertThat(call(get("/api/v1/me")).status()).isEqualTo(401);
    }

    @Test
    void contentIsPublic() throws Exception {
        Response manifest = call(get("/api/v1/content/manifest"));
        assertThat(manifest.status()).isEqualTo(200);
        assertThat(manifest.body().path("chapters")).hasSize(27);
        assertThat(manifest.body().path("stops")).hasSize(7);
        assertThat(call(get("/api/v1/content/chapters/nope")).code()).isEqualTo("CHAPTER_NOT_FOUND");
    }

    @Test
    void duplicateEmailAndWrongPasswordAreRejected() throws Exception {
        JsonNode user = register("Ayşe");
        String email = user.path("email").asText();

        Response duplicate = postJson("/api/v1/auth/register", null, Map.of(
            "email", email.toUpperCase(), "password", "another password", "displayName", "Ayşe"));
        assertThat(duplicate.status()).isEqualTo(409);
        assertThat(duplicate.code()).isEqualTo("EMAIL_TAKEN");

        Response wrong = postJson("/api/v1/auth/login", null, Map.of("email", email, "password", "nope nope"));
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(wrong.code()).isEqualTo("INVALID_CREDENTIALS");

        Response ok = postJson("/api/v1/auth/login", null, Map.of("email", email, "password", "correct horse battery"));
        assertThat(ok.status()).isEqualTo(200);
        assertThat(ok.body().path("accessToken").asText()).isNotBlank();
    }

    @Test
    void validationErrorsNameTheField() throws Exception {
        Response r = postJson("/api/v1/auth/register", null, Map.of(
            "email", "not-an-email", "password", "short", "displayName", "X"));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.code()).isEqualTo("VALIDATION_FAILED");
        assertThat(r.body().path("fields").has("email")).isTrue();
        assertThat(r.body().path("fields").has("password")).isTrue();
    }

    @Test
    void refreshTokensRotateAndReuseClosesEverySession() throws Exception {
        String first = register("Mert").path("refreshToken").asText();

        Response rotated = postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", first));
        assertThat(rotated.status()).isEqualTo(200);
        String second = rotated.body().path("refreshToken").asText();
        assertThat(second).isNotEqualTo(first);

        Response reused = postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", first));
        assertThat(reused.status()).isEqualTo(401);
        assertThat(reused.code()).isEqualTo("REFRESH_TOKEN_REUSED");

        // The theft response revoked the newer token too.
        Response afterTheft = postJson("/api/v1/auth/refresh", null, Map.of("refreshToken", second));
        assertThat(afterTheft.status()).isEqualTo(401);
    }

    @Test
    void deletingTheAccountRemovesIt() throws Exception {
        JsonNode user = register("Deniz");
        String token = user.path("accessToken").asText();
        assertThat(call(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/v1/me")
            .header("Authorization", "Bearer " + token)).status()).isEqualTo(204);

        Response login = postJson("/api/v1/auth/login", null,
            Map.of("email", user.path("email").asText(), "password", "correct horse battery"));
        assertThat(login.status()).isEqualTo(401);
    }
}
