package com.gate21.speech;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.common.ApiException;
import com.gate21.common.ProviderUnavailableException;
import com.gate21.config.AppProperties.AzureProps;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Azure AI Speech, REST API for short audio (up to 60 s). Pronunciation Assessment runs in
 * scripted mode against the reference sentence. Audio is streamed through and never stored.
 */
public class AzureSpeechAssessor implements SpeechAssessor {

    private static final String WAV = "audio/wav; codecs=audio/pcm; samplerate=16000";

    private final RestClient http;
    private final ObjectMapper mapper;
    private final AzureProps props;
    private final CircuitBreaker breaker;

    public AzureSpeechAssessor(AzureProps props, ObjectMapper mapper) {
        if (props.key() == null || props.key().isBlank()) {
            throw new IllegalStateException("SPEECH_PROVIDER=azure needs AZURE_SPEECH_KEY");
        }
        this.props = props;
        this.mapper = mapper;
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(props.timeout());
        this.http = RestClient.builder()
            .requestFactory(factory)
            .baseUrl("https://" + props.region() + ".stt.speech.microsoft.com")
            .defaultHeader("Ocp-Apim-Subscription-Key", props.key())
            .build();
        this.breaker = CircuitBreaker.of("azure-speech", CircuitBreakerConfig.custom()
            .slidingWindowSize(20)
            .minimumNumberOfCalls(10)
            .failureRateThreshold(50)
            .waitDurationInOpenState(Duration.ofSeconds(30))
            .ignoreExceptions(ApiException.class)
            .build());
    }

    @Override
    public Assessment assess(byte[] wav, String referenceText) {
        JsonNode best = call(() -> recognize(wav, "detailed", pronunciationHeader(referenceText)));
        JsonNode pa = best.has("PronunciationAssessment") ? best.get("PronunciationAssessment") : best;
        List<WordScore> words = new ArrayList<>();
        for (JsonNode w : best.path("Words")) {
            JsonNode wpa = w.has("PronunciationAssessment") ? w.get("PronunciationAssessment") : w;
            words.add(new WordScore(w.path("Word").asText(), score(wpa, "AccuracyScore"),
                wpa.path("ErrorType").asText("None")));
        }
        return new Assessment(score(pa, "AccuracyScore"), score(pa, "FluencyScore"),
            score(pa, "CompletenessScore"), score(pa, "PronScore"), words);
    }

    @Override
    public String transcribe(byte[] wav) {
        JsonNode best = call(() -> recognize(wav, "detailed", null));
        return best.path("Display").asText("");
    }

    @Override
    public String name() {
        return "azure";
    }

    private JsonNode call(Supplier<JsonNode> request) {
        try {
            return breaker.executeSupplier(request);
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new ProviderUnavailableException("SPEECH_UNAVAILABLE", "Azure Speech call failed: " + e.getMessage(), e);
        }
    }

    private JsonNode recognize(byte[] wav, String format, String assessmentHeader) {
        RestClient.RequestBodySpec spec = http.post()
            .uri(uri -> uri.path("/speech/recognition/conversation/cognitiveservices/v1")
                .queryParam("language", props.language())
                .queryParam("format", format)
                .build())
            .contentType(MediaType.parseMediaType(WAV))
            .accept(MediaType.APPLICATION_JSON);
        if (assessmentHeader != null) {
            spec = spec.header("Pronunciation-Assessment", assessmentHeader);
        }
        JsonNode root = spec.body(wav).retrieve().body(JsonNode.class);
        String status = root == null ? "Empty" : root.path("RecognitionStatus").asText();
        if (!"Success".equals(status)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SPEECH_NOT_RECOGNIZED",
                "We couldn't hear you clearly. Try again a little closer to the microphone.");
        }
        JsonNode best = root.path("NBest").path(0);
        if (best.isMissingNode()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SPEECH_NOT_RECOGNIZED",
                "We couldn't hear you clearly. Try again.");
        }
        return best;
    }

    private String pronunciationHeader(String referenceText) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("ReferenceText", referenceText);
        config.put("GradingSystem", "HundredMark");
        config.put("Granularity", "Word");
        config.put("Dimension", "Comprehensive");
        config.put("EnableMiscue", true);
        try {
            byte[] json = mapper.writeValueAsString(config).getBytes(StandardCharsets.UTF_8);
            return Base64.getEncoder().encodeToString(json);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static int score(JsonNode node, String field) {
        return (int) Math.round(Math.max(0, Math.min(100, node.path(field).asDouble(0))));
    }
}
