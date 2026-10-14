# Architecture

The full product architecture (scale assumptions, cost model, privacy, roadmap) lives in the
team's design doc. This file keeps the parts that change with the code.

## API (`/api/v1`)

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | JWT access token (15 min) + rotating refresh token (30 days). A reused refresh token closes every session of that user. |
| `GET /me`, `PATCH /me`, `DELETE /me` | Home summary (journey day, streak, XP, next chapter), profile and voice consent, account deletion |
| `GET /content/manifest`, `/content/chapters/{slug}`, `/content/placement`, `/content/sos` | Public, cacheable content packs (ETag) |
| `POST /placement` | Scores the travel check (`INITIAL` sets the start day, `FINAL` is the Day 21 retest) |
| `POST /progress/sync` | Up to 200 offline attempts, idempotent per `clientId` |
| `GET /progress/passport` | Stars, stamps and lock state per chapter |
| `POST /speech/assess` | Multipart audio + `referenceText` → pronunciation scores |
| `POST /roleplay/sessions`, `POST /roleplay/sessions/{id}/turns` | Start a scene; send a turn (audio and/or text) |

Errors are RFC 9457 `application/problem+json` with a stable `code` (for example `SPEECH_QUOTA_EXCEEDED`); the app maps codes to Turkish messages.

## Game rules

- Each step: 10 XP, +5 when the speaking score is 80 or more. Survive: 50 XP.
- A local day counts when the learner earned at least 50 XP that day (in their own time zone).
- Streak = consecutive counted days; it breaks after a missed day.
- Journey day = start day (from placement: 1, 8 or 15) + counted days before today, capped at 21. Missing a day never skips content.
- Chapter stars after all six steps: 1, or 2 with an average speaking score of 70+, or 3 with 85+.

## Data model

`users`, `refresh_tokens`, `user_stats`, `daily_activity`, `attempts`, `chapter_progress`, `placement_results`,
`speech_assessments`, `roleplay_sessions`, `roleplay_turns`, `usage_counters` — see
`backend/src/main/resources/db/migration`.

## Adding a chapter

1. Add `content/chapters/<slug>.json` and its scenario in `content/scenarios/`.
2. Set `"available": true` for it in `content/manifest.json` and bump `version`.
3. `ContentServiceTest` validates the cross-references; deployed apps pick the new pack up from `/content/manifest`.
