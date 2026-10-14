package com.gate21.speech;

import com.gate21.common.ApiException;
import com.gate21.common.Db;
import com.gate21.common.QuotaService;
import com.gate21.config.AppProperties;
import com.gate21.speech.SpeechAssessor.Assessment;
import com.gate21.speech.SpeechAssessor.WordScore;
import com.gate21.user.UserRepository;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Validates and meters audio before it reaches the paid provider. Not transactional on purpose:
 * no database connection is held while waiting for Azure.
 */
@Service
public class SpeechService {

    static final int MAX_AUDIO_BYTES = 512 * 1024;

    public record WordResult(String word, int score, String errorType) {
    }

    public record AssessResponse(int overall, int accuracy, int fluency, int completeness, List<WordResult> words,
                                 String weakestWord, String tipTr) {
    }

    private final SpeechAssessor assessor;
    private final AudioNormalizer normalizer;
    private final QuotaService quota;
    private final UserRepository users;
    private final JdbcClient jdbc;
    private final AppProperties props;
    private final Clock clock;

    public SpeechService(SpeechAssessor assessor, AudioNormalizer normalizer, QuotaService quota,
                         UserRepository users, JdbcClient jdbc, AppProperties props, Clock clock) {
        this.assessor = assessor;
        this.normalizer = normalizer;
        this.quota = quota;
        this.users = users;
        this.jdbc = jdbc;
        this.props = props;
        this.clock = clock;
    }

    public AssessResponse assess(UUID userId, byte[] upload, String referenceText) {
        requireConsent(userId);
        validateSize(upload);
        String reference = referenceText == null ? "" : referenceText.strip();
        if (reference.isEmpty() || reference.length() > 200) {
            throw ApiException.badRequest("INVALID_REFERENCE_TEXT", "referenceText must be 1–200 characters");
        }

        byte[] audio = normalizer.toWav(upload);
        quota.consume(userId, QuotaService.SPEECH, props.quota().speechPerDay(), "SPEECH_QUOTA_EXCEEDED");
        Assessment result;
        try {
            result = assessor.assess(audio, reference);
        } catch (RuntimeException e) {
            quota.release(userId, QuotaService.SPEECH);
            throw e;
        }

        jdbc.sql("""
                INSERT INTO speech_assessments (id, user_id, reference_text, accuracy, fluency, completeness, overall, provider, created_at)
                VALUES (:id, :userId, :ref, :accuracy, :fluency, :completeness, :overall, :provider, :now)
                """)
            .param("id", UUID.randomUUID())
            .param("userId", userId)
            .param("ref", reference)
            .param("accuracy", result.accuracy())
            .param("fluency", result.fluency())
            .param("completeness", result.completeness())
            .param("overall", result.overall())
            .param("provider", assessor.name())
            .param("now", Db.ts(clock.instant()))
            .update();

        List<WordResult> words = result.words().stream()
            .map(w -> new WordResult(w.word(), w.accuracy(), w.errorType()))
            .toList();
        WordScore weakest = result.words().stream()
            .min(Comparator.comparingInt(WordScore::accuracy))
            .orElse(null);
        String weakestWord = weakest != null && weakest.accuracy() < 80 ? weakest.word() : null;
        return new AssessResponse(result.overall(), result.accuracy(), result.fluency(), result.completeness(),
            words, weakestWord, tip(result, weakestWord));
    }

    /** Transcribes free speech for role-play. Returns null when the provider cannot transcribe. */
    public String transcribe(UUID userId, byte[] upload) {
        requireConsent(userId);
        validateSize(upload);
        byte[] audio = normalizer.toWav(upload);
        quota.consume(userId, QuotaService.SPEECH, props.quota().speechPerDay(), "SPEECH_QUOTA_EXCEEDED");
        try {
            String text = assessor.transcribe(audio);
            if (text == null) {
                quota.release(userId, QuotaService.SPEECH);
            }
            return text;
        } catch (RuntimeException e) {
            quota.release(userId, QuotaService.SPEECH);
            throw e;
        }
    }

    private void requireConsent(UUID userId) {
        boolean consented = users.findById(userId).map(u -> u.voiceConsentAt() != null).orElse(false);
        if (!consented) {
            throw new ApiException(HttpStatus.FORBIDDEN, "VOICE_CONSENT_REQUIRED",
                "Voice processing needs your consent first.");
        }
    }

    static void validateSize(byte[] audio) {
        if (audio == null || audio.length < 44) {
            throw ApiException.badRequest("AUDIO_MISSING", "Audio is missing or empty.");
        }
        if (audio.length > MAX_AUDIO_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "AUDIO_TOO_LARGE", "Audio must be at most 15 seconds.");
        }
    }

    private static String tip(Assessment result, String weakestWord) {
        if (result.completeness() < 60) {
            return "Cümlenin tamamını söylemeyi dene.";
        }
        if (weakestWord != null) {
            return "“" + weakestWord + "” kelimesini biraz daha yavaş ve net söylemeyi dene.";
        }
        if (result.fluency() < 70) {
            return "Kelimeler arasında durmadan, akıcı söylemeyi dene.";
        }
        return "Çok net! Böyle devam.";
    }
}
