package com.gate21;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.RequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base class for API tests: the whole application against a real PostgreSQL in Docker, with
 * the fake speech and role-play providers so no test touches the network.
 */
@SpringBootTest(properties = {
    "management.server.port=",
    "gate21.auth.attempts-per-minute=1000",
    "gate21.quota.speech-per-day=3",
    "gate21.quota.roleplay-sessions-per-day=5",
    "gate21.speech.provider=fake",
    "gate21.roleplay.provider=fake"
})
@AutoConfigureMockMvc
@Import(IntegrationTest.Containers.class)
public abstract class IntegrationTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class Containers {

        @Bean
        @ServiceConnection
        PostgreSQLContainer<?> postgres() {
            return new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
        }
    }

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper mapper;

    protected record Response(int status, JsonNode body) {

        public String code() {
            return body.path("code").asText();
        }
    }

    protected Response call(RequestBuilder request) throws Exception {
        MvcResult result = mvc.perform(request).andReturn();
        String content = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode body = content.isEmpty() ? mapper.createObjectNode() : mapper.readTree(content);
        return new Response(result.getResponse().getStatus(), body);
    }

    protected Response postJson(String path, String token, Object body) throws Exception {
        var req = post(path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        if (token != null) {
            req.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        return call(req);
    }

    protected Response getJson(String path, String token) throws Exception {
        return call(get(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    protected Response patchJson(String path, String token, Object body) throws Exception {
        return call(patch(path).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    /** Registers a fresh user and returns the whole token response. */
    protected JsonNode register(String displayName) throws Exception {
        String email = "u" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        Response r = postJson("/api/v1/auth/register", null, Map.of(
            "email", email, "password", "correct horse battery", "displayName", displayName,
            "timezone", "Europe/Istanbul"));
        if (r.status() != 201) {
            throw new IllegalStateException("register failed: " + r.body());
        }
        ((com.fasterxml.jackson.databind.node.ObjectNode) r.body()).put("email", email);
        return r.body();
    }

    protected String token(String displayName) throws Exception {
        return register(displayName).path("accessToken").asText();
    }

    protected String tokenWithVoiceConsent(String displayName) throws Exception {
        String token = token(displayName);
        Response r = patchJson("/api/v1/me", token, Map.of("voiceConsent", true));
        if (r.status() != 200) {
            throw new IllegalStateException("consent failed: " + r.body());
        }
        return token;
    }

    /** A minimal valid 16 kHz mono PCM WAV of {@code samples} samples. */
    protected static byte[] wav(int samples, int seed) {
        int dataBytes = samples * 2;
        ByteBuffer b = ByteBuffer.allocate(44 + dataBytes).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + dataBytes).put("WAVE".getBytes(StandardCharsets.US_ASCII));
        b.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 1)
            .putInt(16000).putInt(32000).putShort((short) 2).putShort((short) 16);
        b.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(dataBytes);
        for (int i = 0; i < samples; i++) {
            b.putShort((short) ((i * 37 + seed) % 2000));
        }
        return b.array();
    }
}
