package com.gate21.speech;

import com.gate21.common.ApiException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Azure's short-audio API takes WAV (PCM). iOS records WAV directly; Android's recorder cannot,
 * so it sends streamable AAC (ADTS) and this class converts it with ffmpeg through pipes — the
 * audio stays in memory and never touches the disk.
 */
@Component
public class AudioNormalizer {

    private static final Logger log = LoggerFactory.getLogger(AudioNormalizer.class);
    private static final long TIMEOUT_SECONDS = 5;

    private final boolean ffmpegAvailable = detectFfmpeg();

    public byte[] toWav(byte[] audio) {
        if (isWav(audio)) {
            return audio;
        }
        if (!ffmpegAvailable) {
            throw unsupported();
        }
        try {
            return transcode(audio);
        } catch (IOException e) {
            log.debug("ffmpeg could not decode the upload: {}", e.getMessage());
            throw unsupported();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw unsupported();
        }
    }

    static boolean isWav(byte[] audio) {
        return audio.length >= 12
            && audio[0] == 'R' && audio[1] == 'I' && audio[2] == 'F' && audio[3] == 'F'
            && audio[8] == 'W' && audio[9] == 'A' && audio[10] == 'V' && audio[11] == 'E';
    }

    private static byte[] transcode(byte[] input) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(List.of(
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le", "-f", "wav",
            "pipe:1"))
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start();

        // Feed stdin on its own (virtual) thread so a full stdout pipe can never deadlock us.
        Thread writer = Thread.ofVirtual().start(() -> {
            try (OutputStream stdin = process.getOutputStream()) {
                stdin.write(input);
            } catch (IOException ignored) {
                // ffmpeg exited early; the exit code below reports the failure.
            }
        });

        ByteArrayOutputStream output = new ByteArrayOutputStream(input.length * 4);
        try (InputStream stdout = process.getInputStream()) {
            stdout.transferTo(output);
        }
        if (!process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IOException("ffmpeg timed out");
        }
        writer.join();
        byte[] wav = output.toByteArray();
        if (process.exitValue() != 0 || !isWav(wav)) {
            throw new IOException("ffmpeg exit code " + process.exitValue());
        }
        return fixSizes(wav);
    }

    /**
     * ffmpeg cannot seek back on a pipe, so it leaves the RIFF and data chunk sizes as 0xFFFFFFFF.
     * Writes the real sizes so strict WAV readers accept the file.
     */
    static byte[] fixSizes(byte[] wav) throws IOException {
        ByteBuffer b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(4, wav.length - 8);
        int pos = 12;
        while (pos + 8 <= wav.length) {
            boolean data = wav[pos] == 'd' && wav[pos + 1] == 'a' && wav[pos + 2] == 't' && wav[pos + 3] == 'a';
            if (data) {
                b.putInt(pos + 4, wav.length - (pos + 8));
                return wav;
            }
            long size = Integer.toUnsignedLong(b.getInt(pos + 4));
            pos += 8 + (int) Math.min(size + (size & 1), wav.length);
        }
        throw new IOException("WAV without a data chunk");
    }

    private static boolean detectFfmpeg() {
        try {
            Process p = new ProcessBuilder("ffmpeg", "-version")
                .redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .start();
            boolean ok = p.waitFor(5, TimeUnit.SECONDS) && p.exitValue() == 0;
            if (!ok) {
                p.destroyForcibly();
            }
            return ok;
        } catch (IOException e) {
            log.warn("ffmpeg not found: only WAV uploads will be accepted (Android recordings will fail)");
            return false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static ApiException unsupported() {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_AUDIO",
            "Audio must be WAV, AAC or WebM/Opus.");
    }
}
