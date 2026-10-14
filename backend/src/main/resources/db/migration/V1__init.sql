CREATE TABLE users (
    id             UUID PRIMARY KEY,
    email          VARCHAR(254) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,
    display_name   VARCHAR(60)  NOT NULL,
    timezone       VARCHAR(64)  NOT NULL DEFAULT 'Europe/Istanbul',
    reminder_hour  SMALLINT     NOT NULL DEFAULT 20 CHECK (reminder_hour BETWEEN 0 AND 23),
    voice_consent_at TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL
);

CREATE TABLE refresh_tokens (
    id           UUID PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   CHAR(64)    NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

CREATE TABLE user_stats (
    user_id          UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    xp_total         INTEGER  NOT NULL DEFAULT 0,
    streak_current   INTEGER  NOT NULL DEFAULT 0,
    streak_best      INTEGER  NOT NULL DEFAULT 0,
    last_active_date DATE,
    start_day        SMALLINT NOT NULL DEFAULT 1,
    placement_score  SMALLINT,
    final_score      SMALLINT,
    speaking_sum     INTEGER  NOT NULL DEFAULT 0,
    speaking_count   INTEGER  NOT NULL DEFAULT 0
);

CREATE TABLE daily_activity (
    user_id    UUID    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    local_date DATE    NOT NULL,
    xp         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, local_date)
);

CREATE TABLE attempts (
    id           UUID PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    client_id    UUID        NOT NULL,
    chapter_slug VARCHAR(40) NOT NULL,
    step         VARCHAR(16) NOT NULL,
    score        SMALLINT,
    xp_awarded   INTEGER     NOT NULL,
    occurred_at  TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT attempts_user_client_uq UNIQUE (user_id, client_id)
);
CREATE INDEX attempts_user_created_idx ON attempts (user_id, created_at);

CREATE TABLE chapter_progress (
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    chapter_slug VARCHAR(40) NOT NULL,
    steps_done   INTEGER     NOT NULL DEFAULT 0,
    score_sum    INTEGER     NOT NULL DEFAULT 0,
    score_count  INTEGER     NOT NULL DEFAULT 0,
    stars        SMALLINT    NOT NULL DEFAULT 0,
    stamped_at   TIMESTAMPTZ,
    PRIMARY KEY (user_id, chapter_slug)
);

CREATE TABLE placement_results (
    id         UUID PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       VARCHAR(10) NOT NULL CHECK (kind IN ('INITIAL', 'FINAL')),
    score      SMALLINT    NOT NULL,
    level      VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX placement_results_user_idx ON placement_results (user_id, created_at);

CREATE TABLE speech_assessments (
    id             UUID PRIMARY KEY,
    user_id        UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reference_text VARCHAR(200) NOT NULL,
    accuracy       SMALLINT     NOT NULL,
    fluency        SMALLINT     NOT NULL,
    completeness   SMALLINT     NOT NULL,
    overall        SMALLINT     NOT NULL,
    provider       VARCHAR(16)  NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL
);
CREATE INDEX speech_assessments_user_idx ON speech_assessments (user_id, created_at);

CREATE TABLE roleplay_sessions (
    id            UUID PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    scenario_slug VARCHAR(40) NOT NULL,
    goal_index    SMALLINT    NOT NULL DEFAULT 0,
    turn_count    SMALLINT    NOT NULL DEFAULT 0,
    status        VARCHAR(12) NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED')),
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX roleplay_sessions_user_idx ON roleplay_sessions (user_id, created_at);

CREATE TABLE roleplay_turns (
    id         UUID PRIMARY KEY,
    session_id UUID         NOT NULL REFERENCES roleplay_sessions (id) ON DELETE CASCADE,
    seq        SMALLINT     NOT NULL,
    role       VARCHAR(4)   NOT NULL CHECK (role IN ('AI', 'USER')),
    text       VARCHAR(600) NOT NULL,
    goal_met   BOOLEAN,
    created_at TIMESTAMPTZ  NOT NULL,
    CONSTRAINT roleplay_turns_seq_uq UNIQUE (session_id, seq)
);

CREATE TABLE usage_counters (
    user_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day     DATE        NOT NULL,
    kind    VARCHAR(16) NOT NULL,
    count   INTEGER     NOT NULL,
    PRIMARY KEY (user_id, day, kind)
);
