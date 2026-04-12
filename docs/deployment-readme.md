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
  Optional comma-separated allowlist of mentor accounts. Matching emails receive the `mentor` role at runtime.
- `ADMIN_EMAILS`
  Optional comma-separated allowlist of admin accounts. Matching emails receive the `admin` role at runtime.

## Local deploy path

1. Use Node 22 LTS. The repo includes [`.nvmrc`](../.nvmrc) and `package.json` engines to keep local/dev/prod builds aligned.
2. Install dependencies with `npm install`
3. Run `npm run build`
4. Start the production server with `npm run start`

## Production smoke validation

- Run `npm run smoke:prod` after framework upgrades or major route changes.
- The smoke script clears `.next`, performs a fresh production build, boots `next start`, waits for `/login`, and then runs the authenticated flow in [`scripts/sample-curl.sh`](../scripts/sample-curl.sh).
- This is the quickest way to catch stale build-artifact issues before treating a local runtime failure as an application bug.

## Containerized dashboard

Build the dashboard image:

```bash
docker build -f infra/Dockerfile.dashboard -t vantage-dashboard .
```

Run:

```bash
docker run --rm -p 3000:3000 vantage-dashboard
```

## API keys and safety

- For the included MVP, the app remains functional without external API keys.
- If both OpenAI and Gemini keys are present, `LLM_PROVIDER` decides which live provider is preferred.
- If a live model is connected, keep mentor-visible flags enabled and avoid disabling the guardrail policy file.
- Guardrails load from `guardrails/policy.yaml` at runtime. To point the app at a different policy file, set `GUARDRAIL_POLICY_PATH` to an absolute path or a path relative to the repo root.

## Resume parsing portability

- Direct parsing is supported for `.pdf`, `.txt`, `.md`, and `.html` resumes.
- `.doc`, `.docx`, `.rtf`, and `.rtfd` conversion currently relies on macOS `textutil`.
- Scanned/image-only PDFs still do not have OCR in this MVP.

## Mentor access

- Mentor pages, flag review endpoints, mentor intervention endpoints, and mentor-scoped event streams require a `mentor` or `admin` role.
- The current repo uses email-based role assignment through `MENTOR_EMAILS` and `ADMIN_EMAILS`. A local account only needs a matching email address to access the mentor dashboard.

## Realtime behavior

- The app uses Server-Sent Events rather than WebSockets for mentor supervision.
- Student sessions subscribe to `/events/stream?scope=session&session_id={session_id}` for guardrail flags and mentor takeover/feedback updates.
- The mentor dashboard subscribes to `/events/stream?scope=mentor` for queue updates.
