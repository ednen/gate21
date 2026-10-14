package com.gate21.roleplay;

import com.gate21.content.ContentModels.Goal;
import com.gate21.content.ContentModels.Option;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Keyword-based judge with the scenario's scripted lines. It is the dev/test model and also
 * the fallback whenever the LLM is slow or down, so a learner never gets stuck mid-scene.
 */
public class ScriptedRoleplayModel implements RoleplayModel {

    @Override
    public Reply respond(Context ctx) {
        Goal goal = ctx.goal();
        String text = normalize(ctx.userText());
        if (goal.twist()) {
            int option = matchOption(goal.options(), text);
            if (option >= 0) {
                return new Reply(goal.options().get(option).reply(), true, "Harika, sorunu çözdün!", option);
            }
            return new Reply(goal.retryReply(), false, "Sorunu çözecek bir şey sor. Seçeneklerden birini dene.", -1);
        }
        if (matchesAny(goal.keywords(), text)) {
            return new Reply(goal.successReply(), true, "Anlaşıldın, devam!", -1);
        }
        return new Reply(goal.retryReply(), false, "Tam anlaşılmadı. İpucundaki cümleyi dene.", -1);
    }

    @Override
    public String name() {
        return "scripted";
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
