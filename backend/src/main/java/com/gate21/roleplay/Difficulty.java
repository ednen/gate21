package com.gate21.roleplay;

/**
 * Scenes get harder with the learner's journey week.
 * READY: hints and reply options visible. CONFIDENT: hints behind a button, character lines
 * heard before they are shown. PRO: no hints and two surprises per slot.
 */
public enum Difficulty {
    READY(1, true),
    CONFIDENT(1, true),
    PRO(2, false);

    private final int twistsPerSlot;
    private final boolean hintsAllowed;

    Difficulty(int twistsPerSlot, boolean hintsAllowed) {
        this.twistsPerSlot = twistsPerSlot;
        this.hintsAllowed = hintsAllowed;
    }

    public int twistsPerSlot() {
        return twistsPerSlot;
    }

    public boolean hintsAllowed() {
        return hintsAllowed;
    }

    public static Difficulty forWeek(int week) {
        return week <= 1 ? READY : week == 2 ? CONFIDENT : PRO;
    }
}
