# Gate 21

**Don't learn English. Learn how to travel in English.**
21 days, 12 real-life situations, 8 minutes a day — for Turkish travellers who freeze when someone speaks English to them.

| | |
| --- | --- |
| `mobile/` | Expo (React Native, TypeScript) app for iOS and Android |
| `backend/` | Spring Boot 3 API (Java 21, PostgreSQL 16, Flyway) |
| `content/` | Versioned content packs (chapters, scenarios, placement test, SOS phrases) shared by app and API |
| `infra/` | docker-compose for a local stack |
| `docs/` | Architecture notes |

## How a chapter works

Every chapter runs the same six-step loop: **Discover → Pronounce → Recognize → Speak → Use → Survive**.
The last step is a live role-play (an AI receptionist, waiter, gate agent…) with an unexpected twist the learner has to solve.
Finishing a chapter stamps the learner's **Travel Passport**. **SOS English** works offline and without an account.

## Run it locally

Requirements: Docker, Java 21 + Maven, Node 22.

```bash
# API + PostgreSQL (fake speech and role-play providers, no keys needed)
docker compose -f infra/docker-compose.yml up --build

# Mobile app
cd mobile
npm install
cp .env.example .env.local   # on a phone, point EXPO_PUBLIC_API_URL to your computer's LAN IP
npx expo start               # recording audio needs a development build: npx expo run:ios | run:android
```

To use the real providers, copy `infra/.env.example` to `infra/.env` and set `SPEECH_PROVIDER=azure` (+ `AZURE_SPEECH_KEY`) and `ROLEPLAY_PROVIDER=gemini` (+ `GEMINI_API_KEY`). Use a paid-tier Gemini key in production: free-tier content is used by Google to improve its products.

## Tests

```bash
mvn -f backend/pom.xml verify      # unit + integration tests (Testcontainers starts PostgreSQL)
cd mobile && npm run typecheck && npm test
```

CI runs both on every push.

## Design decisions in one place

- **Modular monolith.** One stateless Spring Boot service, packages per module (`auth`, `user`, `content`, `progress`, `placement`, `speech`, `roleplay`). Plain SQL through `JdbcClient`, schema via Flyway.
- **Offline first.** Lesson content and SOS phrases are bundled; every finished step goes into a persisted queue on the device and is synced in batches. Each attempt carries a client UUID, unique per user in the database, so a retried sync never awards XP twice.
- **Consistency.** A sync locks the user's stats row (`SELECT … FOR UPDATE`), so two devices syncing at once are applied in order. Role-play turns use optimistic concurrency (`turn_count`), so no lock is held while the model is thinking.
- **Providers behind interfaces.** `SpeechAssessor` (Azure Pronunciation Assessment) and `RoleplayModel` (Gemini 2.5 Flash-Lite) have deterministic fakes for development and tests. The scene's flow — which goal is current, when the twist comes — lives in code; the model only phrases replies and judges the current goal. If the model is slow or down, a scripted fallback answers.
- **Audio.** iOS records 16 kHz WAV directly. Android's recorder cannot write WAV, so it records streamable AAC and the API converts it with ffmpeg through pipes, in memory. Audio is never stored.
- **Cost control.** Per-user daily quotas (speech assessments, role-play sessions) in PostgreSQL with an atomic upsert; circuit breakers on both providers.
- **Privacy.** Explicit voice consent before the first recording, account deletion (`DELETE /api/v1/me`), raw rows purged after 90 days.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the API surface, rules and data model.
