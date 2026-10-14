package com.gate21.content;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.ChapterMeta;
import com.gate21.content.ContentModels.Manifest;
import com.gate21.content.ContentModels.Placement;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentModels.WeekInfo;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Loads the versioned content packs from the classpath once at startup and validates that
 * they reference each other correctly, so a broken pack fails the build instead of a user.
 */
@Service
public class ContentService {

    private final Manifest manifest;
    private final byte[] manifestJson;
    private final Map<String, byte[]> chapterJson = new LinkedHashMap<>();
    private final Map<String, ChapterMeta> chapterMeta = new LinkedHashMap<>();
    private final Map<String, Scenario> scenarios = new LinkedHashMap<>();
    private final Placement placement;
    private final byte[] placementJson;
    private final byte[] sosJson;

    public ContentService(ObjectMapper mapper) {
        this.manifestJson = read("content/manifest.json");
        this.manifest = parse(mapper, manifestJson, Manifest.class);
        this.placementJson = read("content/placement.json");
        this.placement = parse(mapper, placementJson, Placement.class);
        this.sosJson = read("content/sos.json");

        for (ChapterInfo chapter : manifest.chapters()) {
            if (!chapter.available()) {
                continue;
            }
            byte[] json = read("content/chapters/" + chapter.slug() + ".json");
            JsonNode node = parse(mapper, json, JsonNode.class);
            String scenarioSlug = node.path("survive").path("scenario").asText();
            chapterJson.put(chapter.slug(), json);
            chapterMeta.put(chapter.slug(), new ChapterMeta(
                chapter.slug(),
                node.path("mission").asText(),
                node.path("missionTr").asText(),
                node.path("stamp").asText(),
                scenarioSlug));

            Scenario scenario = parse(mapper, read("content/scenarios/" + scenarioSlug + ".json"), Scenario.class);
            validate(scenario, chapter.slug());
            scenarios.put(scenario.slug(), scenario);
        }
        if (placement.bands().isEmpty() || placement.bands().getFirst().min() != 0) {
            throw new IllegalStateException("placement.json must have a band starting at 0");
        }
    }

    public String version() {
        return manifest.version();
    }

    public Manifest manifest() {
        return manifest;
    }

    public byte[] manifestJson() {
        return manifestJson;
    }

    public Optional<byte[]> chapterJson(String slug) {
        return Optional.ofNullable(chapterJson.get(slug));
    }

    public Optional<ChapterMeta> chapterMeta(String slug) {
        return Optional.ofNullable(chapterMeta.get(slug));
    }

    public boolean isAvailableChapter(String slug) {
        return chapterJson.containsKey(slug);
    }

    /** Available chapters in learning order. */
    public List<ChapterInfo> availableChapters() {
        return manifest.chapters().stream()
            .filter(ChapterInfo::available)
            .sorted(Comparator.comparingInt(ChapterInfo::order))
            .toList();
    }

    public Optional<Scenario> scenario(String slug) {
        return Optional.ofNullable(scenarios.get(slug));
    }

    public Placement placement() {
        return placement;
    }

    public byte[] placementJson() {
        return placementJson;
    }

    public byte[] sosJson() {
        return sosJson;
    }

    public WeekInfo weekForDay(int journeyDay) {
        WeekInfo current = manifest.weeks().getFirst();
        for (WeekInfo week : manifest.weeks()) {
            if (journeyDay >= week.startDay()) {
                current = week;
            }
        }
        return current;
    }

    private static void validate(Scenario scenario, String chapterSlug) {
        if (!chapterSlug.equals(scenario.chapter())) {
            throw new IllegalStateException("Scenario " + scenario.slug() + " belongs to " + scenario.chapter()
                + " but is used by " + chapterSlug);
        }
        if (scenario.goals().isEmpty()) {
            throw new IllegalStateException("Scenario " + scenario.slug() + " has no goals");
        }
        for (var goal : scenario.goals()) {
            boolean hasOptions = !goal.options().isEmpty();
            if (goal.twist() != hasOptions) {
                throw new IllegalStateException("Goal " + goal.id() + " in " + scenario.slug()
                    + ": twist goals need options, other goals must not have them");
            }
            if (!hasOptions && (goal.keywords().isEmpty() || goal.successReply() == null || goal.hint() == null)) {
                throw new IllegalStateException("Goal " + goal.id() + " in " + scenario.slug()
                    + " needs keywords, hint and successReply");
            }
            if (goal.retryReply() == null) {
                throw new IllegalStateException("Goal " + goal.id() + " in " + scenario.slug() + " needs retryReply");
            }
        }
    }

    private static byte[] read(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Missing content file " + path, e);
        }
    }

    private static <T> T parse(ObjectMapper mapper, byte[] json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (IOException e) {
            throw new UncheckedIOException("Invalid content JSON for " + type.getSimpleName(), e);
        }
    }
}
