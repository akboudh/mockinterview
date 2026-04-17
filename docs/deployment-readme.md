# Deployment Notes

## Required environment variables

- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `LLM_PROVIDER`
  Set to `openai`, `gemini`, or `deterministic`.
- `OPENAI_MODEL`
- `GEMINI_MODEL`
- `NEXT_PUBLIC_APP_URL`
  Public app URL for absolute links if needed in deployment.
- `MENTOR_EMAILS`
  Optional comma-separated list. Used to **gate mentor account creation** (along with `MENTOR_SIGNUP_CODE` where applicable). Roles are persisted on the user record in the database after signup; they are not re-merged from this env on every request.
- `ADMIN_EMAILS`
  Optional comma-separated list used where the app gates admin account creation.
- `APP_SURFACE` (optional)
  `student` or `mentor` when running separate processes or containers. Omit for a single combined service.
- `MENTOR_APP_URL` / `STUDENT_APP_URL` (optional)
  When using split surfaces, set each process’s public origin so login links and middleware redirects target the correct host.
- `GUARDRAIL_PROVIDER`
  `local` by default. Set to `external` if you want to call an external guardrail endpoint before falling back to the local YAML policy.
- `GUARDRAIL_API_URL`
  Required when `GUARDRAIL_PROVIDER=external`. The app sends the text, source, and session metadata to this HTTP endpoint.
- `GUARDRAIL_API_KEY`
  Optional bearer token for the external guardrail endpoint.
- `GUARDRAIL_TIMEOUT_MS`
  Optional timeout in milliseconds before the app falls back to the local YAML guardrail policy.
- `GUARDRAIL_POLICY_PATH`
  Optional override for the local YAML policy file. This still acts as the fallback policy even when an external provider is configured.

## Local deploy path

1. Use Node 22 LTS. The repo includes [`.nvmrc`](../.nvmrc) and `package.json` engines to keep local/dev/prod builds aligned.
2. Install dependencies with `npm install`
3. Run `npm run build`
4. Start the production server with `npm run start`

## Production smoke validation

- Run `npm run smoke:prod` after framework upgrades or major route changes.
- The smoke script clears `.next`, performs a fresh production build, boots `next start`, waits for `/login`, and then runs the authenticated flow in [`scripts/sample-curl.sh`](../scripts/sample-curl.sh).
- This is the quickest way to catch stale build-artifact issues before treating a local runtime failure as an application bug.

## Containerized integrated app

Build the image:

```bash
docker build -t vantage-mockinterview .
```

Run:

```bash
docker run --rm -p 3000:3000 --env-file .env vantage-mockinterview
```

This image can run the full app in one process: student pages, mentor pages, API routes, LangGraph interview runtime, LangChain-backed memory layer, and SSE event streams. For split student/mentor containers, configure `APP_SURFACE`, `MENTOR_APP_URL`, and `STUDENT_APP_URL` consistently (see `docker-compose.split.yml` in the repo).

## API keys and safety

- For the included MVP, the app remains functional without external API keys.
- If both OpenAI and Gemini keys are present, `LLM_PROVIDER` decides which live provider is preferred.
- If a live model is connected, keep mentor-visible flags enabled and avoid disabling the guardrail policy file.
- Guardrails load from `guardrails/policy.yaml` at runtime. To point the app at a different policy file, set `GUARDRAIL_POLICY_PATH` to an absolute path or a path relative to the repo root.
- When `GUARDRAIL_PROVIDER=external`, the app first calls the external endpoint and then falls back to the local YAML policy if the provider is unavailable, times out, or returns an invalid payload.

## Resume parsing portability

- Direct parsing is supported for `.pdf`, `.txt`, `.md`, and `.html` resumes.
- `.doc`, `.docx`, `.rtf`, and `.rtfd` conversion currently relies on macOS `textutil`.
- Scanned/image-only PDFs still do not have OCR in this MVP.

## Mentor access

- Mentor pages, flag review endpoints, mentor intervention endpoints, and mentor-scoped event streams require a `mentor` or `admin` role stored on the user in the database.
- `MENTOR_EMAILS`, `ADMIN_EMAILS`, and `MENTOR_SIGNUP_CODE` control who may **create** mentor (or admin) accounts; they do not replace database roles for authorization on each request.

## Architecture note

- The orchestrator remains a `LangGraph` runtime.
- The memory layer now uses `LangChain` abstractions for transcript buffering, embeddings, and semantic retrieval while preserving the existing local SQLite-backed memory service.
- You may deploy one integrated `Next.js` service or split student/mentor surfaces with `APP_SURFACE` and matching URL env vars.

## Realtime behavior

- The app uses Server-Sent Events rather than WebSockets for mentor supervision.
- Student sessions subscribe to `/events/stream?scope=session&session_id={session_id}` for guardrail flags and mentor takeover/feedback updates.
- The mentor dashboard subscribes to `/events/stream?scope=mentor` for queue updates.
