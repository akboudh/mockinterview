# Orchestrator Rules

## Default flow
- Default phase: `interview_setup`
- Auto-advance from `interview_setup` to `opening` because setup inputs are collected in the web form.
- The first `/ask_question` call with no `latest_answer` is a `first_turn`.
- The first generated interviewer message should establish tone and immediately ask a substantive role-aware question.

## Live interview behavior
- The active student loop alternates between `interview_round` and `deep_dive`.
- Use `deep_dive` when the latest answer is short, structurally incomplete, low-evidence, or missing a clear result.
- Use `interview_round` when the answer was solid enough to continue the main interview flow.
- Move to `session_feedback` once the configured question limit is reached or the session is explicitly ended.

## Transition confidence and redirects
- Suggested phase changes from the Analyzer are proposals, not automatic truth.
- The Orchestrator validates phase transitions against `phase_registry.json`.
- If the Analyzer proposes a different phase than the current one, retry extraction once using the suggested phase's analyzer instructions.
- Maximum redirect attempts in one turn: `2`
- If redirects keep oscillating, remain in the current live phase and ask a clarification-focused question.

## Turn limits
- Global question limit: `5`
- Opening phase should not persist longer than one interviewer question.
- `deep_dive` should return to `interview_round` unless the session is ending.

## Question strategy
- Behavioral mode should privilege STAR coverage and interpersonal detail.
- Technical mode should privilege requirements, tradeoffs, risks, and failure handling.
- Case mode should privilege structure, assumptions, recommendation quality, and success metrics.
- Use historical weak skills to bias follow-up targets when personalization is enabled.

## Short-term memory
- Keep the last `4` transcript messages as direct short-term context.
- Maintain a rolling conversation summary for older context.

## Summarization
- Refresh the conversation summary every `2` interviewer turns or on phase transition.
- Summary output should stay concise and mention role, mode, recent answer quality, and the most important follow-up theme.

## Safety and mentor support
- Run deterministic guardrails on student input, generated interviewer questions, and mentor-visible summaries.
- Persist flags to both the flag queue and episodic memory.
- Mentor takeover sets the live session status to `paused` and marks `mentor_takeover_active = true`.

## Fallback messaging
- If generation fails, use deterministic question templates.
- If analysis fails, treat the answer as `limited` quality and ask a clarification or evidence-seeking follow-up.
- If summarization fails, retain the previous conversation summary.
