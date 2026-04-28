# Vantage Mock Interview MVP

Local-first mock interview platform with a guided interview loop, rubric-based evaluation, memory-driven personalization, guardrails, and mentor review + per-session feedback.

## Features (current)

- **Student app**
  - signup/login/logout
  - interview setup (`/setup`) for role/mode/focus + resume ingestion
  - live interview loop (`/interview/[sessionId]`) with phases and optional question TTS
  - rubric evaluation + STAR breakdown + growth tips (`/results/[sessionId]`)
  - history (`/history`) + insights (`/insights`)
  - async mentor messaging thread (`/student/mentor`)
- **Mentor app**
  - mentor login + dashboard (`/mentor`) with student directory + flag queue
  - session transcript review + flag review workflow
  - **supplemental per-session feedback**; students see it in results/history
- **Safety**
  - local YAML guardrail policy with a provider adapter (optional external provider + local fallback)
  - mentor-visible flags and realtime updates
- **Local-first infra**
  - SQLite persistence for sessions, transcript, evaluations, flags, mentor feedback
  - SSE event stream for realtime UI updates
  - optional Redis Pub/Sub for multi-process split dev (SQLite fallback bridge when Redis is absent)

## How it’s built (high level)

- **Next.js App Router** serves both pages and API routes.
- **Interview runtime** is a phase-based flow (Analyzer → Orchestrator → Speaker).
- **Memory** is treated as 3 layers:
  - **short-term**: recent transcript/runtime state (within the current session)
  - **episodic**: per-session records (evaluations, flags, summaries)
  - **long-term**: embeddings-backed retrieval across sessions
- **Guardrails** run during evaluation to flag unsafe content and notify the mentor dashboard.
- **Mentor feedback** is stored per session and shown back to the student in results/history.

For a deeper walkthrough, see [`docs/app-workflow.md`](./docs/app-workflow.md).

## Quickstart (run on your own desktop)

### Prerequisites

- Node.js `22` recommended (`package.json` supports `>=20 <25`, `.nvmrc` is `22`)
- npm
- Git
- optional: OpenAI or Gemini API key if you want live model output (otherwise deterministic fallback works)

### 1) Install

```bash
git clone <your-repo-url>
cd mockinterview
npm install
```

### 2) Configure env

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Notes:
- Next.js also loads `.env.local` (overrides). Use either.
- Defaults in `.env.example` are safe: `LLM_PROVIDER=deterministic`, blank API keys, SQLite at `data/mockinterview.sqlite`.

### 3) Run (single integrated app)

```bash
npm run dev
```

Open the printed URL (usually `http://localhost:3000`). The dev launcher will use `3000` if free, otherwise it picks the next available port (see `scripts/dev.mjs`).

### 4) Use the app

- student login: `/login`
- start an interview: `/setup`
- results: `/results/[sessionId]`
- history: `/history`
- insights: `/insights`
- mentor login/dashboard: `/mentor/login` → `/mentor`

## Split student / mentor dev (optional)

You can run two Next.js processes:
- **student** surface on `http://student.localhost:3000`
- **mentor** surface on `http://mentor.localhost:3001`

This is useful for cookie isolation (hostnames, not ports) and “separate app” behavior in development/Docker.

### Recommended: run Redis

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

### Start both

```bash
npm run dev:both
```

Or separately:

```bash
npm run dev:student
npm run dev:mentor
```

### Required env (in `.env`)

- `MENTOR_APP_URL=http://mentor.localhost:3001`
- `STUDENT_APP_URL=http://student.localhost:3000`

If `REDIS_URL` is not set, split dev still works using the SQLite realtime bridge fallback (slightly higher latency).

## Docker (integrated app)

```bash
docker build -t vantage-mockinterview .
docker run --rm -p 3000:3000 --env-file .env vantage-mockinterview
```

For split containers, see `docker-compose.split.yml`.

## Commands

- `npm run dev` - integrated dev server
- `npm run dev:both` - split student+mentor dev
- `npm run build` - production build
- `npm run start` - run after build
- `npm test` - Vitest suite
- `npm run seed` - generate synthetic data
- `npm run db:clear` - truncate local DB tables (keeps schema)
- `npm run db:wipe` - delete local DB files (full reset)
- `npm run smoke:prod` - production-style smoke test
- `npm run ppt:build` - build the PPT template (`slides/build_mockinterview_ppt.mjs`)

## Key environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path. Defaults to `data/mockinterview.sqlite`. |
| `LLM_PROVIDER` | `deterministic`, `openai`, or `gemini`. |
| `OPENAI_API_KEY` | Required only when using OpenAI. |
| `GOOGLE_API_KEY` | Required only when using Gemini. |
| `OPENAI_MODEL` / `GEMINI_MODEL` | Model names. |
| `APP_SURFACE` | `student` or `mentor` for split processes; omit for integrated app. |
| `MENTOR_APP_URL` / `STUDENT_APP_URL` | Cross-app origins for split mode. |
| `REDIS_URL` | Optional Redis Pub/Sub for split mode realtime. |
| `GUARDRAIL_PROVIDER` | `local` (default) or `external` (with local fallback). |
| `GUARDRAIL_API_URL` / `GUARDRAIL_API_KEY` | External guardrail provider endpoint + token (optional). |
| `GUARDRAIL_POLICY_PATH` | Override local guardrail policy path. |

## Authentication + roles (important)

Roles are stored on the user record in the database.
- `MENTOR_EMAILS`, `ADMIN_EMAILS`, and `MENTOR_SIGNUP_CODE` are used to **gate account creation**, not to re-assign roles on every request.

## Current limitations

- **Local SQLite**: great for local-first dev; for high concurrency or multi-host deployment you’d likely move to Postgres.
- **Realtime without Redis**: split mode works via a SQLite polling bridge, but latency is higher than Redis Pub/Sub.
- **Resume parsing portability**: `.doc/.docx/.rtf/.rtfd` conversion may rely on platform tools; PDFs/text are the most portable.
- **Engines**: repo targets Node `>=20 <25` (Node 22 recommended).

## Troubleshooting

- **Ports busy (split dev)**: free `3000/3001` or adjust the scripts; the split launcher fails fast when required ports are taken.
- **“Unexpected token < in JSON”**: indicates the client got HTML instead of JSON (typically a redirect or error page).
- **SQLite locked / I/O issues**: stop stray dev servers and retry; the DB layer sets busy timeouts and WAL/DELETE fallback pragmas.

## API + docs

- OpenAPI: [`docs/openapi.yaml`](./docs/openapi.yaml)
- workflow/architecture: [`docs/app-workflow.md`](./docs/app-workflow.md)
- deployment notes: [`docs/deployment-readme.md`](./docs/deployment-readme.md)
- status report: [`docs/project-status-report.md`](./docs/project-status-report.md)
- schema notes: [`docs/schema.md`](./docs/schema.md)
- guardrails policy: [`guardrails/policy.yaml`](./guardrails/policy.yaml)
- rubric library: [`rubrics/interview-rubrics.yaml`](./rubrics/interview-rubrics.yaml)
