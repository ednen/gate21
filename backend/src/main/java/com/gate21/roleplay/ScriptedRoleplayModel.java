package com.gate21.roleplay;

import com.gate21.content.ContentModels.Option;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Keyword judge with the scenario's scripted lines. It is the dev/test model and also the
 * fallback whenever the LLM is slow or down, so a learner never gets stuck mid-scene and
 * always gets a report.
 */
public class ScriptedRoleplayModel implements RoleplayModel {

    @Override
    public Reply respond(Context ctx) {
        SceneStep step = ctx.step();
        String text = normalize(ctx.userText());
        if (step.twist()) {
            int option = matchOption(step.options(), text);
            if (option >= 0) {
                return new Reply(step.options().get(option).reply(), true, "Harika, sorunu çözdün!", option);
            }
            return new Reply(step.retryReply(), false, "Sorunu çözecek bir şey sor ya da iste.", -1);
        }
        if (matchesAny(step.keywords(), text)) {
            return new Reply(step.successReply(), true, "Anlaşıldın, devam!", -1);
        }
        return new Reply(step.retryReply(), false, "Tam anlaşılmadı. Soruya cevap vermeyi dene.", -1);
    }

    @Override
    public Review review(ReviewContext ctx) {
        Map<String, SceneStep> steps = new LinkedHashMap<>();
        ctx.steps().forEach(s -> steps.put(s.id(), s));
        Map<String, Integer> failures = new LinkedHashMap<>();
        Set<String> seen = new LinkedHashSet<>();

        List<ReviewLine> lines = new ArrayList<>();
        for (UserLine line : ctx.userLines()) {
            SceneStep step = steps.get(line.stepId());
            boolean firstTry = seen.add(line.stepId());
            if (!line.goalMet()) {
                failures.merge(line.stepId(), 1, Integer::sum);
            }
            String better = step == null ? line.text() : model(step, line.text());
            boolean ok = line.goalMet() && firstTry;
            String note = ok ? "Doğal ve anlaşılır."
                : line.goalMet() ? "Anlaşıldın; böyle söylemek daha doğal olur."
                : "Bu cümle istenen şeyi karşılamadı. Şöyle söyleyebilirsin.";
            lines.add(new ReviewLine(line.text(), better, note, ok));
        }

        String hardest = failures.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(e -> {
                SceneStep step = steps.get(e.getKey());
                String title = step != null && step.titleTr() != null ? step.titleTr() : "bir adım";
                return "En çok “" + title + "” anında zorlandın (" + e.getValue() + " tekrar).";
            })
            .orElse("Hiç takılmadan bitirdin — harika!");

        List<Phrase> phrases = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        List<SceneStep> order = new ArrayList<>();
        failures.keySet().forEach(id -> order.add(steps.get(id)));
        ctx.steps().stream().filter(SceneStep::twist).forEach(order::add);
        order.addAll(ctx.steps());
        for (SceneStep step : order) {
            if (step == null || phrases.size() == 3) {
                continue;
            }
            Phrase phrase = step.twist() && !step.options().isEmpty()
                ? new Phrase(step.options().getFirst().text(), "")
                : new Phrase(step.hint(), step.hintTr() == null ? "" : step.hintTr());
            if (phrase.en() != null && used.add(phrase.en())) {
                phrases.add(phrase);
            }
        }
        return new Review(lines, hardest, phrases);
    }

    @Override
    public String name() {
        return "scripted";
    }

    /** The model sentence for a step: the closest option of a surprise, or the goal's hint. */
    private static String model(SceneStep step, String said) {
        if (step.twist()) {
            int option = matchOption(step.options(), normalize(said));
            return step.options().get(Math.max(option, 0)).text();
        }
        return step.hint();
    }

    static int matchOption(List<Option> options, String normalizedText) {
        int best = -1;
        int bestHits = 0;
        for (int i = 0; i < options.size(); i++) {
            int hits = 0;
            for (String keyword : options.get(i).keywords()) {
                if (contains(normalizedText, keyword)) {
                    hits++;
                }
            }
            if (hits > bestHits) {
                best = i;
                bestHits = hits;
            }
        }
        return best;
    }

    static boolean matchesAny(List<String> keywords, String normalizedText) {
        return keywords.stream().anyMatch(k -> contains(normalizedText, k));
    }

    static boolean contains(String normalizedText, String keyword) {
        String k = normalize(keyword);
        if (k.isEmpty()) {
            return false;
        }
        return Pattern.compile("(^|\\W)" + Pattern.quote(k) + "($|\\W)").matcher(normalizedText).find();
    }

    static String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replace('’', '\'').strip();
    }
}
