package com.gate21.content;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gate21.content.ContentModels.ChapterInfo;
import com.gate21.content.ContentModels.ChapterMeta;
import com.gate21.content.ContentModels.Fact;
import com.gate21.content.ContentModels.Goal;
import com.gate21.content.ContentModels.Option;
import com.gate21.content.ContentModels.Manifest;
import com.gate21.content.ContentModels.Placement;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentModels.Twist;
import com.gate21.content.ContentModels.TwistSlot;
import com.gate21.content.ContentModels.WeekInfo;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
                "simulation".equals(node.path("type").asText()),
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

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)}");

    /** Fails startup (and CI) when a scenario is inconsistent, instead of failing a learner mid-scene. */
    static void validate(Scenario s, String chapterSlug) {
        String where = "Scenario " + s.slug() + ": ";
        check(chapterSlug.equals(s.chapter()), where + "belongs to " + s.chapter() + " but is used by " + chapterSlug);
        check(!s.goals().isEmpty(), where + "has no goals");
        check(notBlank(s.opening()) && notBlank(s.role()) && notBlank(s.persona()), where + "needs opening, role and persona");

        Set<String> goalIds = new HashSet<>();
        for (int i = 0; i < s.goals().size(); i++) {
            Goal g = s.goals().get(i);
            check(goalIds.add(g.id()), where + "duplicate goal " + g.id());
            check(notBlank(g.instruction()) && notBlank(g.hint()) && notBlank(g.successReply())
                && notBlank(g.retryReply()) && !g.keywords().isEmpty(),
                where + "goal " + g.id() + " needs instruction, hint, keywords, successReply and retryReply");
            check(i == 0 || notBlank(g.ask()), where + "goal " + g.id() + " needs an ask line");
            if (g.role() != null) {
                check(i > 0 && notBlank(g.setting()) && notBlank(g.persona()),
                    where + "goal " + g.id() + " starts a segment, so it needs setting and persona");
            }
        }

        Set<String> twistIds = new HashSet<>();
        for (Twist t : s.twists()) {
            check(twistIds.add(t.id()), where + "duplicate twist " + t.id());
            check(notBlank(t.intro()) && notBlank(t.instruction()) && notBlank(t.retryReply()),
                where + "twist " + t.id() + " needs intro, instruction and retryReply");
            check(t.options().size() >= 2, where + "twist " + t.id() + " needs at least 2 options");
            for (Option o : t.options()) {
                check(notBlank(o.text()) && notBlank(o.reply()) && !o.keywords().isEmpty(),
                    where + "twist " + t.id() + " has an incomplete option");
            }
        }
        for (TwistSlot slot : s.twistSlots()) {
            check(goalIds.contains(slot.after()), where + "twist slot after unknown goal " + slot.after());
            check(!slot.pool().isEmpty() && twistIds.containsAll(slot.pool()), where + "twist slot has unknown twists");
        }

        Set<String> known = new HashSet<>(Set.of("name"));
        for (Fact f : s.facts()) {
            check(f.values().size() >= 3 && notBlank(f.question()), where + "fact " + f.id() + " needs 3+ values and a question");
            known.add(f.id());
        }
        for (String line : lines(s)) {
            Matcher m = PLACEHOLDER.matcher(line);
            while (m.find()) {
                check(known.contains(m.group(1)), where + "unknown placeholder {" + m.group(1) + "}");
            }
        }
    }

    private static List<String> lines(Scenario s) {
        List<String> out = new ArrayList<>();
        Collections.addAll(out, s.opening(), s.setting(), s.persona(), s.briefTr(), s.closing());
        for (Goal g : s.goals()) {
            Collections.addAll(out, g.ask(), g.hint(), g.hintTr(), g.successReply(), g.retryReply(), g.setting(), g.persona());
        }
        for (Twist t : s.twists()) {
            Collections.addAll(out, t.intro(), t.retryReply());
            t.options().forEach(o -> Collections.addAll(out, o.text(), o.reply()));
        }
        out.removeIf(Objects::isNull);
        return out;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static void check(boolean ok, String message) {
        if (!ok) {
            throw new IllegalStateException(message);
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
