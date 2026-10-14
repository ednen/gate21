package com.gate21.roleplay;

import com.gate21.content.ContentModels.Goal;
import com.gate21.content.ContentModels.Scenario;
import java.util.List;

/** Produces the character's next line and judges whether the learner met the current goal. */
public interface RoleplayModel {

    record Turn(String role, String text) {
    }

    record Context(Scenario scenario, int goalIndex, List<Turn> history, String userText, String guestName) {

        public Goal goal() {
            return scenario.goals().get(goalIndex);
        }
    }

    /** {@code optionIndex} is the matched option of a twist goal, or -1. */
    record Reply(String reply, boolean goalMet, String feedbackTr, int optionIndex) {
    }

    Reply respond(Context context);

    String name();
}
