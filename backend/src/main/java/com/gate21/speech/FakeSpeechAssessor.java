package com.gate21.speech;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic stand-in for local development and tests: no network, and the same audio and
 * sentence always give the same score (between 70 and 95).
 */
public class FakeSpeechAssessor implements SpeechAssessor {

    @Override
    public Assessment assess(byte[] wav, String referenceText) {
        int seed = Math.floorMod(Arrays.hashCode(wav) * 31 + referenceText.hashCode(), 26);
        int overall = 70 + seed;
        List<WordScore> words = new ArrayList<>();
        String[] tokens = referenceText.replaceAll("[^A-Za-z' -]", " ").trim().split("\\s+");
        for (int i = 0; i < tokens.length; i++) {
            if (tokens[i].isBlank()) {
                continue;
            }
            int accuracy = Math.min(100, overall - 6 + Math.floorMod(seed + i * 7, 13));
            words.add(new WordScore(tokens[i].toLowerCase(Locale.ROOT), accuracy, "None"));
        }
        return new Assessment(overall, Math.min(100, overall + 3), 100, overall, words);
    }

    @Override
    public String transcribe(byte[] wav) {
        return null;
    }

    @Override
    public String name() {
        return "fake";
    }
}
