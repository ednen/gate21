package com.gate21.roleplay;

/**
 * A scene is as hard as the level of its lesson.
 * BRONZE: hints and reply options visible, slow speech. SILVER: hints behind a button,
 * character lines heard before they are shown. GOLD: no hints and two surprises per slot.
 */
public enum Difficulty {
    BRONZE(1, true),
    SILVER(1, true),
    GOLD(2, false);

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
        return week <= 1 ? BRONZE : week == 2 ? SILVER : GOLD;
    }
}
