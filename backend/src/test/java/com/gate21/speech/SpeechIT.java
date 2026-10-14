package com.gate21.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.gate21.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class SpeechIT extends IntegrationTest {

    private Response assess(String token, byte[] audio, String reference) throws Exception {
        return call(multipart("/api/v1/speech/assess")
            .file(new MockMultipartFile("audio", "a.wav", "audio/wav", audio))
            .param("referenceText", reference)
            .header("Authorization", "Bearer " + token));
    }

    @Test
    void voiceNeedsConsentFirst() throws Exception {
        Response r = assess(token("Ozan"), wav(1600, 1), "passport");
        assertThat(r.status()).isEqualTo(403);
        assertThat(r.code()).isEqualTo("VOICE_CONSENT_REQUIRED");
    }

    @Test
    void scoresAWavAgainstTheReferenceSentence() throws Exception {
        Response r = assess(tokenWithVoiceConsent("Ozan"), wav(16000, 7), "Where is the check-in counter?");

        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().path("overall").asInt()).isBetween(70, 95);
        assertThat(r.body().path("words")).hasSize(5);
        assertThat(r.body().path("tipTr").asText()).isNotBlank();
    }

    @Test
    void rejectsAudioThatIsNotWav() throws Exception {
        byte[] mp3ish = new byte[2000];
        mp3ish[0] = 'I';
        mp3ish[1] = 'D';
        mp3ish[2] = '3';
        Response r = assess(tokenWithVoiceConsent("Ozan"), mp3ish, "passport");
        assertThat(r.status()).isEqualTo(415);
        assertThat(r.code()).isEqualTo("UNSUPPORTED_AUDIO");
    }

    @Test
    void enforcesTheDailyQuota() throws Exception {
        String token = tokenWithVoiceConsent("Ozan");
        // The test profile allows 3 assessments a day.
        for (int i = 0; i < 3; i++) {
            assertThat(assess(token, wav(1600, i), "passport").status()).isEqualTo(200);
        }
        Response blocked = assess(token, wav(1600, 9), "passport");
        assertThat(blocked.status()).isEqualTo(429);
        assertThat(blocked.code()).isEqualTo("SPEECH_QUOTA_EXCEEDED");
    }
}
