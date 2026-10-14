package com.gate21.progress;

/** The six steps of every chapter, in order. Each step is one bit in chapter_progress.steps_done. */
public enum Step {
    DISCOVER, PRONOUNCE, RECOGNIZE, SPEAK, USE, SURVIVE;

    public static final int ALL_BITS = (1 << values().length) - 1;

    public int bit() {
        return 1 << ordinal();
    }
}
