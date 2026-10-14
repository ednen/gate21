package com.gate21.speech;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.gate21.common.ApiException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class AudioNormalizerTest {

    private final AudioNormalizer normalizer = new AudioNormalizer();

    @Test
    void wavPassesThroughUntouched() {
        byte[] wav = streamedWav(100);
        assertThat(normalizer.toWav(wav)).isSameAs(wav);
    }

    @Test
    void garbageIsRejected() {
        byte[] garbage = new byte[3000];
        for (int i = 0; i < garbage.length; i++) {
            garbage[i] = (byte) (i * 31);
        }
        try {
            normalizer.toWav(garbage);
            throw new AssertionError("expected UNSUPPORTED_AUDIO");
        } catch (ApiException e) {
            assertThat(e.code()).isEqualTo("UNSUPPORTED_AUDIO");
        }
    }

    @Test
    void streamedHeaderSizesAreRepaired() throws Exception {
        byte[] wav = AudioNormalizer.fixSizes(streamedWav(100));
        ByteBuffer b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        assertThat(b.getInt(4)).isEqualTo(wav.length - 8);
        assertThat(b.getInt(40)).isEqualTo(200);
    }

    @Test
    void androidAacBecomes16kMonoWav(@TempDir Path dir) throws Exception {
        assumeTrue(ffmpegInstalled(), "ffmpeg not installed");
        Path aac = dir.resolve("sample.aac");
        Process p = new ProcessBuilder("ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi",
            "-i", "sine=frequency=440:duration=1", "-ar", "16000", "-ac", "1", "-c:a", "aac", "-f", "adts",
            aac.toString()).start();
        assertThat(p.waitFor(20, TimeUnit.SECONDS)).isTrue();

        byte[] wav = normalizer.toWav(Files.readAllBytes(aac));
        ByteBuffer b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        assertThat(AudioNormalizer.isWav(wav)).isTrue();
        assertThat(b.getShort(22)).isEqualTo((short) 1);
        assertThat(b.getInt(24)).isEqualTo(16000);
        assertThat(b.getInt(4)).isEqualTo(wav.length - 8);
    }

    /** A WAV as ffmpeg writes it to a pipe: both sizes unknown (0xFFFFFFFF). */
    private static byte[] streamedWav(int samples) {
        ByteBuffer b = ByteBuffer.allocate(44 + samples * 2).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(-1).put("WAVE".getBytes(StandardCharsets.US_ASCII));
        b.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 1)
            .putInt(16000).putInt(32000).putShort((short) 2).putShort((short) 16);
        b.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(-1);
        return b.array();
    }

    private static boolean ffmpegInstalled() {
        try {
            return new ProcessBuilder("ffmpeg", "-version").start().waitFor(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            return false;
        }
    }
}
