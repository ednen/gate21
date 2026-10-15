-- Scenes v2: random surprises, per-session facts, difficulty, hint/failure counters and the
-- end-of-scene report.
ALTER TABLE roleplay_sessions
    ADD COLUMN difficulty   VARCHAR(10) NOT NULL DEFAULT 'READY',
    ADD COLUMN plan         TEXT        NOT NULL DEFAULT '[]',
    ADD COLUMN facts        TEXT        NOT NULL DEFAULT '{}',
    ADD COLUMN hints_used   SMALLINT    NOT NULL DEFAULT 0,
    ADD COLUMN failed_turns SMALLINT    NOT NULL DEFAULT 0,
    ADD COLUMN report       TEXT;

-- Sessions started with the old format cannot continue under the new plan model.
UPDATE roleplay_sessions SET status = 'ABANDONED' WHERE status = 'ACTIVE';

ALTER TABLE roleplay_turns
    ADD COLUMN kind    VARCHAR(12) NOT NULL DEFAULT 'say',
    ADD COLUMN step_id VARCHAR(40);
