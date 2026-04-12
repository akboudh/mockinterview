# Vantage Mock Interview MVP

Vantage is a local-first mock interview platform for students. It includes a guided setup flow, adaptive live interview loop, rubric-based evaluation, memory recall across sessions, mentor review tools, and a deterministic fallback mode so the app still runs without live LLM keys.

## What the app does

- student sign-up, login, setup, interview, results, history, and insights flows
- AI interview runtime with `Analyzer -> Orchestrator -> Speaker` separation
- rubric-based evaluation with STAR analysis and optional self-critique
- short-term, episodic, and long-term memory for personalization
- guardrails for unsafe or hostile content
- mentor dashboard, flag review, feedback, and live takeover
- local SQLite persistence with cookie-based auth

## Product workflow

1. A student signs up or logs in.
2. On `/setup`, they choose a target role, interview mode, focus area, notes, and optionally upload a resume.
3. `POST /start_session` creates the session, initializes runtime state, and recalls prior context if personalization is enabled.
4. The live interview page calls `POST /ask_question` to generate the first question.
5. Each student answer goes through `POST /evaluate_response`, which saves the answer, runs guardrails, evaluates it against the rubric, and writes memory events.
6. The app recalls fresh context and calls `POST /ask_question` again for the next turn.
7. When the interview ends, the session moves to `session_feedback`, and the user can review `/results/[sessionId]`, `/history`, and `/insights`.
8. Mentors can log in separately, review flags, leave feedback, or take over a live session from `/mentor`.

For the full architecture walkthrough, see [`docs/app-workflow.md`](./docs/app-workflow.md).

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
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Default behavior in `.env.example` is safe for local onboarding:

- `LLM_PROVIDER=deterministic`
- API keys can stay blank
- SQLite writes to `data/mockinterview.sqlite`

If someone wants live model output instead of deterministic fallback:

- set `LLM_PROVIDER=openai` and add `OPENAI_API_KEY`
- or set `LLM_PROVIDER=gemini` and add `GOOGLE_API_KEY`

### 3. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

On first run, the app will create the SQLite database automatically if it does not exist.

### 4. Use the app

- create a student account from `/login`
- start an interview from `/setup`
- review results in `/results/[sessionId]`
- browse prior sessions in `/history`
- check trends in `/insights`

For mentor access on another machine:

- set `MENTOR_EMAILS` or `ADMIN_EMAILS` to a comma-separated allowlist
- or keep `MENTOR_SIGNUP_CODE` set and create a mentor account from `/mentor/login`

## Local development workflow

Typical developer loop:

1. `npm install`
2. copy `.env.example` to `.env.local`
3. run `npm run dev`
4. make changes
5. run `npm test`
6. run `npm run build` before pushing larger changes
7. optionally run `npm run smoke:prod` for a production-style validation pass

The smoke script does a fresh build, boots `next start`, waits for `/login`, and exercises the main authenticated API flow through [`scripts/sample-curl.sh`](./scripts/sample-curl.sh).

## Useful scripts

- `npm run dev` - start the Next.js dev server
- `npm run build` - production build
- `npm run start` - run the production server after building
- `npm test` - run the Vitest suite
- `npm run test:watch` - watch mode for tests
- `npm run db:import` - import legacy seed data from [`data/mock-db.json`](./data/mock-db.json)
- `npm run db:clear` - clear the local SQLite database
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
| `NEXT_PUBLIC_APP_URL` | Base app URL, usually `http://localhost:3000` locally. |
| `MENTOR_EMAILS` | Optional mentor email allowlist. |
| `ADMIN_EMAILS` | Optional admin email allowlist. |
| `MENTOR_SIGNUP_CODE` | Shared code for mentor account creation in local/dev use. |
| `GUARDRAIL_POLICY_PATH` | Optional override for the guardrail policy file. |

## Portability notes

- The app works without external AI keys by using deterministic fallbacks.
- Resume parsing supports `.pdf`, `.txt`, `.md`, and `.html` directly.
- `.doc`, `.docx`, `.rtf`, and `.rtfd` parsing currently depends on macOS `textutil`, so on Windows/Linux it is safer to use PDF or plain text resumes.
- `npm run smoke:prod` uses `bash`, `curl`, and `python3`; on Windows, run it in WSL or Git Bash.

## API and docs

- OpenAPI contract: [`docs/openapi.yaml`](./docs/openapi.yaml)
- architecture and end-to-end flow: [`docs/app-workflow.md`](./docs/app-workflow.md)
- deployment notes: [`docs/deployment-readme.md`](./docs/deployment-readme.md)
- data model summary: [`docs/schema.md`](./docs/schema.md)
- socket event notes: [`docs/socket-events.md`](./docs/socket-events.md)
- guardrail policy: [`guardrails/policy.yaml`](./guardrails/policy.yaml)
- rubric library: [`rubrics/interview-rubrics.yaml`](./rubrics/interview-rubrics.yaml)
