package com.gate21.roleplay;

import com.gate21.content.ContentModels.Fact;
import com.gate21.content.ContentModels.Goal;
import com.gate21.content.ContentModels.Option;
import com.gate21.content.ContentModels.Scenario;
import com.gate21.content.ContentModels.Twist;
import com.gate21.content.ContentModels.TwistSlot;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.random.RandomGenerator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a scenario into one concrete play-through: which surprises happen (drawn from each
 * slot's pool) and which facts the characters mention (room number, gate…). The plan and the
 * facts are stored with the session so every turn sees the same scene.
 */
public final class ScenePlanner {

    static final String GOAL = "g:";
    static final String TWIST = "t:";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)}");

    private ScenePlanner() {
    }

    /** Step ids in order, goals as {@code g:<id>} and surprises as {@code t:<id>}. */
    public static List<String> plan(Scenario scenario, Difficulty difficulty, RandomGenerator random) {
        List<String> plan = new ArrayList<>();
        for (Goal goal : scenario.goals()) {
            plan.add(GOAL + goal.id());
            for (TwistSlot slot : scenario.twistSlots()) {
                if (slot.after().equals(goal.id())) {
                    List<String> pool = new ArrayList<>(slot.pool());
                    int count = Math.min(difficulty.twistsPerSlot(), pool.size());
                    for (int i = 0; i < count; i++) {
                        plan.add(TWIST + pool.remove(random.nextInt(pool.size())));
                    }
                }
            }
        }
        return plan;
    }

    public static Map<String, String> facts(Scenario scenario, RandomGenerator random) {
        Map<String, String> facts = new LinkedHashMap<>();
        for (Fact fact : scenario.facts()) {
            facts.put(fact.id(), fact.values().get(random.nextInt(fact.values().size())));
        }
        return facts;
    }

    /** The plan as rendered steps, with segment roles carried forward and placeholders filled. */
    public static List<SceneStep> resolve(Scenario s, List<String> plan, Map<String, String> facts, String guestName) {
        Map<String, String> values = new LinkedHashMap<>(facts);
        values.put("name", guestName);

        String role = s.role();
        String setting = s.setting();
        String voice = s.voice();
        String persona = s.persona();
        List<SceneStep> steps = new ArrayList<>();
        for (int i = 0; i < plan.size(); i++) {
            String ref = plan.get(i);
            if (ref.startsWith(GOAL)) {
                Goal g = goal(s, ref.substring(GOAL.length()));
                boolean segmentStart = i > 0 && g.role() != null;
                if (g.role() != null) {
                    role = g.role();
                    setting = g.setting();
                    voice = g.voice() != null ? g.voice() : voice;
                    persona = g.persona();
                }
                steps.add(new SceneStep(g.id(), false, g.titleTr(), fill(g.ask(), values), fill(g.instruction(), values),
                    fill(g.hint(), values), fill(g.hintTr(), values), g.keywords(), fill(g.successReply(), values),
                    fill(g.retryReply(), values), List.of(), role, fill(setting, values), voice,
                    fill(persona, values), segmentStart));
            } else {
                Twist t = twist(s, ref.substring(TWIST.length()));
                List<Option> options = t.options().stream()
                    .map(o -> new Option(fill(o.text(), values), o.keywords(), fill(o.reply(), values)))
                    .toList();
                steps.add(new SceneStep(t.id(), true, t.titleTr(), fill(t.intro(), values), fill(t.instruction(), values),
                    null, null, List.of(), null, fill(t.retryReply(), values), options, role, fill(setting, values),
                    voice, fill(persona, values), false));
            }
        }
        return steps;
    }

    public static String fill(String text, Map<String, String> values) {
        if (text == null) {
            return null;
        }
        Matcher m = PLACEHOLDER.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            m.appendReplacement(out, Matcher.quoteReplacement(values.getOrDefault(m.group(1), m.group())));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static Goal goal(Scenario s, String id) {
        return s.goals().stream().filter(g -> g.id().equals(id)).findFirst()
            .orElseThrow(() -> new IllegalStateException("Plan refers to missing goal " + id));
    }

    private static Twist twist(Scenario s, String id) {
        return s.twists().stream().filter(t -> t.id().equals(id)).findFirst()
            .orElseThrow(() -> new IllegalStateException("Plan refers to missing twist " + id));
    }
}
