-- Journey v3: seven stops revisited at Bronze, Silver and Gold, a Starter pack for zero-English
-- learners, graduation, and memberships.

ALTER TABLE user_stats
    ADD COLUMN starter_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN graduated_at        TIMESTAMPTZ;

CREATE TABLE memberships (
    user_id    UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    plan       VARCHAR(16) NOT NULL CHECK (plan IN ('JOURNEY', 'KEEP_READY')),
    source     VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- The old week-1 chapters are the Bronze lessons of the same stops. The old airport chapter
-- (departure check-in) has no counterpart: arrival is new content.
UPDATE chapter_progress SET chapter_slug = chapter_slug || '-bronze'
WHERE chapter_slug IN ('hotel', 'restaurant', 'shopping');
DELETE FROM chapter_progress WHERE chapter_slug = 'airport';

UPDATE roleplay_sessions SET scenario_slug = CASE scenario_slug
    WHEN 'hotel-checkin' THEN 'hotel-bronze'
    WHEN 'restaurant-order' THEN 'restaurant-bronze'
    WHEN 'shopping-size' THEN 'shopping-bronze'
    ELSE scenario_slug END;
UPDATE roleplay_sessions SET difficulty = CASE difficulty
    WHEN 'READY' THEN 'BRONZE'
    WHEN 'CONFIDENT' THEN 'SILVER'
    WHEN 'PRO' THEN 'GOLD'
    ELSE difficulty END;
UPDATE roleplay_sessions SET status = 'ABANDONED' WHERE status = 'ACTIVE';
ALTER TABLE roleplay_sessions ALTER COLUMN difficulty SET DEFAULT 'BRONZE';
