package com.gate21.roleplay;

import com.gate21.content.ContentModels.Option;
import java.util.List;

/**
 * One step of a planned scene with every placeholder filled in: a goal, or a surprise. For a
 * surprise, {@code ask} is its intro and {@code options} are the suggested ways to solve it.
 * Role, setting, voice and persona are inherited from the last goal that started a segment.
 */
public record SceneStep(String id, boolean twist, String titleTr, String ask, String instruction, String hint,
                        String hintTr, List<String> keywords, String successReply, String retryReply,
                        List<Option> options, String role, String setting, String voice, String persona,
                        boolean segmentStart) {

    public SceneStep {
        keywords = keywords == null ? List.of() : List.copyOf(keywords);
        options = options == null ? List.of() : List.copyOf(options);
    }
}
