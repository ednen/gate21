package com.gate21.roleplay;

import java.util.List;

/**
 * The language model behind a scene: it phrases the character's next line, judges whether the
 * learner met the current step, and writes the coaching report at the end.
 */
public interface RoleplayModel {

    /** A line of the conversation. role: AI or USER. */
    record Turn(String role, String text) {
    }

    record Context(SceneStep step, List<Turn> history, String userText, String guestName) {
    }

    /** {@code optionIndex} is the matched option of a surprise, or -1. */
    record Reply(String reply, boolean goalMet, String feedbackTr, int optionIndex) {
    }

    /** One thing the learner said, with the step it was said in. */
    record UserLine(String text, String stepId, boolean goalMet) {
    }

    record ReviewContext(String title, List<Turn> transcript, List<UserLine> userLines, List<SceneStep> steps) {
    }

    /** Per learner line: a more natural way to say it and a short Turkish note. */
    record ReviewLine(String said, String better, String noteTr, boolean ok) {
    }

    record Phrase(String en, String tr) {
    }

    record Review(List<ReviewLine> lines, String hardestTr, List<Phrase> phrases) {
    }

    Reply respond(Context context);

    Review review(ReviewContext context);

    String name();
}
