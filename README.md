# Vantage Mock Interview MVP

Vantage is a local-first mock interview platform for students. It includes a guided setup flow, adaptive live interview loop, rubric-based evaluation, memory recall across sessions, mentor review tools, and a deterministic fallback mode so the app still runs without live LLM keys.

## What the app does

- student sign-up, login, setup, interview, results, history, and insights flows
- AI interview runtime with `Analyzer -> Orchestrator -> Speaker` separation
- rubric-based evaluation with STAR analysis and optional self-critique
- short-term, episodic, and long-term memory for personalization
- LangChain-backed memory abstractions for transcript buffering, embeddings, and semantic retrieval
- guardrails for unsafe or hostile content with optional external-provider checks and local YAML fallback
- mentor dashboard, flag review, and per-session feedback (students see feedback in session results/history)
- local SQLite persistence with cookie-based auth

## Product workflow

1. A student signs up or logs in.
2. On `/setup`, they choose a target role, interview mode, focus area, notes, and optionally upload a resume.
3. `POST /start_session` creates the session, initializes runtime state, and recalls prior context if personalization is enabled.
4. The live interview page calls `POST /ask_question` to generate the first question.
5. Each student answer goes through `POST /evaluate_response`, which saves the answer, runs guardrails, evaluates it against the rubric, and writes memory events.
6. The app recalls fresh context and calls `POST /ask_question` again for the next turn.
7. When the interview ends, the session moves to `session_feedback`, and the user can review `/results/[sessionId]`, `/history`, and `/insights`.
8. Mentors can log in separately, review flags, and leave per-session feedback from `/mentor`. Students see that feedback in `/results/[sessionId]` and `/history`.

For the full architecture walkthrough, see [`docs/app-workflow.md`](./docs/app-workflow.md).

## Architecture snapshot

- the interview orchestrator stays on `LangGraph`; the Analyzer, phase logic, and Speaker runtime are unchanged by the infrastructure work in this repo
- the memory layer is where `LangChain` abstractions now live: embeddings, retriever interfaces, and short-term transcript buffering are wrapped behind the local memory service
- guardrails run through a provider adapter; local YAML rules remain the default, and an external guardrail endpoint can be configured without removing the local fallback
- **Deployment shape**: one `Next.js` process can serve everything (student + mentor + APIs + SSE). Optionally you run **two** processes with `APP_SURFACE=student` and `APP_SURFACE=mentor` (see [Split student / mentor dev](#split-student--mentor-dev-optional)) for separate origins and clearer role separation in development or Docker.

## Stack

- `Next.js` App Router
- `React` + `Tailwind CSS`
- `Framer Motion`
- `LangGraph` and `LangChain`
- OpenAI and Gemini provider adapters
- deterministic fallback provider when no API key is configured
- `better-sqlite3` + `Drizzle ORM`

## Run this on another PC

### Prerequisites

- Node.js `22` recommended (`package.json` supports `>=20 <25`, `.nvmrc` is `22`)
- npm
- Git
- optional: OpenAI or Gemini API key if you want live model responses

### 1. Clone and install

```bash
git clone <your-repo-url>
cd mockinterview
nvm use 22
npm install
```

If the other developer does not use `nvm`, installing Node 22 manually is fine.

### 2. Create local env config

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

You can use `.env.local` instead; Next.js loads both (`.env.local` overrides). Default values in `.env.example` are safe for onboarding:

- `LLM_PROVIDER=deterministic`
- API keys can stay blank
- SQLite writes to `data/mockinterview.sqlite`

If someone wants live model output instead of deterministic fallback:

- set `LLM_PROVIDER=openai` and add `OPENAI_API_KEY`
- or set `LLM_PROVIDER=gemini` and add `GOOGLE_API_KEY`

### 3. Start the app

**Single integrated dev server** (default):

```bash
npm run dev
```

The launcher prefers port `3000` and, if that port is busy, picks the next free port (see `scripts/dev.mjs`).

On first run, the app creates the SQLite database if it does not exist.

### 3a. Mentor dashboard on a separate origin (split student / mentor)

The codebase can run as **two apps**: students on one port, mentors on another. The **mentor surface** only serves mentor routes (`/mentor`, `/flags`, auth, SSE, health); visiting `/` goes to `/mentor`. The **student surface** sends any `/mentor/*` request to `MENTOR_APP_URL` so the dashboard always lives on the mentor origin.

**Start Redis** (recommended for fastest live updates across two Node processes):

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

**One terminal (both servers):**

```bash
npm run dev:both
```

**Or two terminals:**

```bash
npm run dev:student   # http://student.localhost:3000 — student app
npm run dev:mentor      # http://mentor.localhost:3001 — mentor app (dashboard at /mentor)
```

**Env (in `.env`):** point each side at the other so login links and redirects work:

- `MENTOR_APP_URL=http://mentor.localhost:3001`
- `STUDENT_APP_URL=http://student.localhost:3000`

**Important (cookie isolation):** cookies are scoped to hostnames, not ports. To stay logged into both apps at once, the split dev scripts bind to **different hostnames**:

- student app: `http://student.localhost:3000`
- mentor app: `http://mentor.localhost:3001`

Do **not** put `APP_SURFACE` in `.env` for local split dev—the `dev:student` / `dev:mentor` / `dev:both` scripts set it per process. Use a **single** combined app only when you run plain `npm run dev` (no `APP_SURFACE`; student + mentor both exist on the same origin).

### 3b. Run the integrated app in Docker

```bash
docker build -t vantage-mockinterview .
docker run --rm -p 3000:3000 --env-file .env vantage-mockinterview
```

For split containers, see `docker-compose.split.yml` and the same `APP_SURFACE` / URL variables as local split dev.

### 4. Use the app

- create a student account from `/login`
- start an interview from `/setup`
- review results in `/results/[sessionId]`
- browse prior sessions in `/history`
- check trends in `/insights`

**Mentor access**: roles are stored on the account in the database (not inferred from env at every request). `MENTOR_EMAILS` / `MENTOR_SIGNUP_CODE` only control **who may create** a mentor account (`/mentor/login` signup). Use `ADMIN_EMAILS` similarly for admin creation paths where applicable.

## Local development workflow

Typical developer loop:

1. `npm install`
2. copy `.env.example` to `.env` (or `.env.local`)
3. run `npm run dev`
4. make changes
5. run `npm test`
6. run `npm run build` before pushing larger changes
7. optionally run `npm run smoke:prod` for a production-style validation pass

The smoke script does a fresh build, boots `next start`, waits for `/login`, and exercises the main authenticated API flow through [`scripts/sample-curl.sh`](./scripts/sample-curl.sh).

## Useful scripts

- `npm run dev` - start the Next.js dev server (port 3000 or next free)
- `npm run dev:student` / `npm run dev:mentor` - split surfaces on `student.localhost:3000` / `mentor.localhost:3001`
- `npm run build` - production build
- `npm run start` - run the production server after building
- `npm test` - run the Vitest suite
- `npm run test:watch` - watch mode for tests
- `npm run db:import` - import legacy seed data from [`data/mock-db.json`](./data/mock-db.json)
- `npm run db:clear` - truncate application tables in the local SQLite DB (keeps schema)
- `npm run db:clean-roles` - reset user roles in the local DB (see script for behavior)
- `npm run db:wipe` - delete local SQLite files and legacy `data/mock-db.json` (full reset)
- `npm run seed` - generate synthetic data
- `npm run smoke:prod` - production smoke check

## Important environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite path. Defaults to `data/mockinterview.sqlite`. |
| `LLM_PROVIDER` | `deterministic`, `openai`, or `gemini`. |
| `OPENAI_API_KEY` | Required only when using OpenAI. |
| `GOOGLE_API_KEY` | Required only when using Gemini. |
| `OPENAI_MODEL` | OpenAI model name. |
| `GEMINI_MODEL` | Gemini model name. |
| `NEXT_PUBLIC_APP_URL` | Optional base app URL. Locally, match the port your dev server actually uses. |
| `APP_SURFACE` | `student` or `mentor` when running split servers; omit for combined app. |
| `MENTOR_APP_URL` / `STUDENT_APP_URL` | Origins for cross-app login links and student-surface redirects away from `/mentor/*`. |
| `MENTOR_EMAILS` | Optional comma-separated list: those emails may **create** a mentor account (with signup flow); roles live in the DB after signup. |
| `ADMIN_EMAILS` | Optional comma-separated list for admin account creation gates where used. |
| `MENTOR_SIGNUP_CODE` | Shared code for mentor account creation in local/dev use. |
| `GUARDRAIL_PROVIDER` | `local` by default. Set to `external` to call an external guardrail endpoint first. |
| `GUARDRAIL_API_URL` | External guardrail endpoint URL used when `GUARDRAIL_PROVIDER=external`. |
| `GUARDRAIL_API_KEY` | Optional bearer token for the external guardrail endpoint. |
| `GUARDRAIL_TIMEOUT_MS` | Timeout for the external guardrail request before falling back locally. |
| `GUARDRAIL_POLICY_PATH` | Optional override for the guardrail policy file. |
| `REDIS_URL` | Optional; used when configuring shared realtime/event features in deployment. |
| `AI_REQUEST_TIMEOUT_MS` | Optional cap on upstream AI request duration. |

## Portability notes

- The app works without external AI keys by using deterministic fallbacks.
- Resume parsing supports `.pdf`, `.txt`, `.md`, and `.html` directly.
- `.doc`, `.docx`, `.rtf`, and `.rtfd` parsing currently depends on macOS `textutil`, so on Windows/Linux it is safer to use PDF or plain text resumes.
- `npm run smoke:prod` uses `bash`, `curl`, and `python3`; on Windows, run it in WSL or Git Bash.

## API and docs

- OpenAPI contract: [`docs/openapi.yaml`](./docs/openapi.yaml)
- architecture and end-to-end flow: [`docs/app-workflow.md`](./docs/app-workflow.md)
- deployment notes: [`docs/deployment-readme.md`](./docs/deployment-readme.md)
- current project status: [`docs/project-status-report.md`](./docs/project-status-report.md)
- data model summary: [`docs/schema.md`](./docs/schema.md)
- socket event notes: [`docs/socket-events.md`](./docs/socket-events.md)
- guardrail policy: [`guardrails/policy.yaml`](./guardrails/policy.yaml)
- rubric library: [`rubrics/interview-rubrics.yaml`](./rubrics/interview-rubrics.yaml)
