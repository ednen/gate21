package com.gate21.progress;

/**
 * The kinds of step a chapter can have. Each chapter lists its own steps in its content file;
 * each step is one bit in chapter_progress.steps_done, so new kinds are only ever appended.
 */
public enum Step {
    DISCOVER, PRONOUNCE, RECOGNIZE, SPEAK, USE, SURVIVE, MATCH, DIALOG, FORM, DIRECTIONS;

    public int bit() {
        return 1 << ordinal();
    }
}
