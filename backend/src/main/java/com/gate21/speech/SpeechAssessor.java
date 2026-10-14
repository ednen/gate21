package com.gate21.speech;

import java.util.List;

/** A pronunciation scorer and transcriber. Implementations: Azure AI Speech, and a fake for dev/tests. */
public interface SpeechAssessor {

    record WordScore(String word, int accuracy, String errorType) {
    }

    record Assessment(int accuracy, int fluency, int completeness, int overall, List<WordScore> words) {
    }

    /** Scores how well {@code wav} (16 kHz mono PCM) matches {@code referenceText}. */
    Assessment assess(byte[] wav, String referenceText);

    /**
     * Free-speech transcription. Returns {@code null} when this implementation cannot transcribe,
     * in which case the caller falls back to the text the client sent.
     */
    String transcribe(byte[] wav);

    String name();
}
