# Data Model Summary

This repo keeps structured interview data in local SQLite, adds a lightweight local vector index for semantic memory recall, and uses rubric-driven evaluation for scoring and feedback.

## Memory Layer

- `memory_events` stores the source-of-truth structured memory records.
- `memory_vectors` stores embedding text plus the numeric vector used for semantic retrieval.
- Semantic recall is embedding-based and runs locally with a deterministic LangChain embeddings adapter.
- Existing events without vectors are backfilled on demand when the memory service reads them.
- Authenticated memory routes derive `user_id` from the current session cookie rather than trusting it from the request body.

## UserProfile

- `user_id`
- `display_name`
- `email`
- `password_hash`
- `resume_text`
- `resume_file_name`
- `target_roles`
- `preferred_modes`
- `known_weak_skills`
- `created_at`
- `updated_at`

## InterviewSession

- `session_id`
- `user_id`
- `mode`
- `target_role`
- `focus_area`
- `confidence_self_rating`
- `status`
- `started_at`
- `ended_at`
- `personalization_enabled`
- `self_critique_enabled`
- `notes`
- `resume_text`
- `recalled_context_summary`

## Message

- `message_id`
- `session_id`
- `speaker_type`
- `content`
- `message_order`
- `created_at`
- `meta`

## EvaluationRecord

- `evaluation_id`
- `session_id`
- `question_message_id`
- `answer_message_id`
- `target_role`
- `mode`
- `clarity_score`
- `structure_score`
- `relevance_score`
- `soft_skills_score`
- `star_situation`
- `star_task`
- `star_action`
- `star_result`
- `overall_summary`
- `actionable_feedback`
- `growth_tips`
- `self_critique_output`
- `rubric_id`
- `rubric_match_type`
- `overall_score`
- `strengths`
- `weak_skills`
- `rubric_coverage`
- `created_at`

## Evaluation Rubric Runtime

- YAML source-of-truth lives in `rubrics/interview-rubrics.yaml`
- Runtime parsing normalizes the YAML into a typed rubric contract with:
  - `rubric_id`
  - `mode`
  - `description`
  - `role_context`
  - `dimensions`
  - `star_fields`
  - `feedback_priorities`
  - `weak_skill_threshold`
  - `strength_skill_threshold`
- Rubric selection is deterministic:
  - exact `mode + role` match when the target role appears in the rubric role context
  - mode default when the mode exists but the role does not match exactly
  - global default when no mode rubric exists
- The evaluator response now includes:
  - rubric metadata (`rubric_id`, `rubric_match_type`)
  - `overall_score`
  - `dimension_scores`
  - rubric-derived `strengths`
  - rubric-derived `weak_skills`
  - structured `rubric_coverage` audit

## MemoryEvent

- `event_id`
- `session_id`
- `user_id`
- `memory_tier`
- `event_type`
- `content`
- `embedding_ref`
- `created_at`
- `updated_at`

## MemoryVectorRecord

- `event_id`
- `user_id`
- `session_id`
- `memory_tier`
- `event_type`
- `mode`
- `target_role`
- `focus_area`
- `embedding_model`
- `embedding_dimensions`
- `embedding_text`
- `vector`
- `created_at`
- `updated_at`

## SkillSignal

- `skill_signal_id`
- `user_id`
- `skill_name`
- `signal_type`
- `source_session_id`
- `source_evaluation_id`
- `notes`
- `created_at`

## FlagEvent

- `flag_id`
- `session_id`
- `message_id`
- `flag_reason`
- `flag_category`
- `status`
- `mentor_notes`
- `created_at`
- `resolved_at`

## MentorIntervention

- `intervention_id`
- `session_id`
- `mentor_message`
- `intervention_type`
- `created_at`

## AgentSessionState

- `session_id`
- `user_id`
- `current_phase`
- `previous_phase`
- `turn_count`
- `redirect_count`
- `turn_type`
- `current_question_id`
- `current_question_text`
- `current_question_type`
- `latest_answer_text`
- `conversation_summary`
- `analyzer_output`
- `missing_signals`
- `follow_up_targets`
- `suggested_phase`
- `guardrail_findings`
- `flagged`
- `mentor_takeover_active`
- `state_json`
- `created_at`
- `updated_at`

## ConversationSummary

- `summary_id`
- `session_id`
- `summary_text`
- `turn_count`
- `created_at`

## Memory API

- `POST /memory/save_event`
  Authenticated create endpoint for structured memory events. The service embeds and indexes the event immediately.
- `POST /memory/recall_context`
  Authenticated semantic recall endpoint. Supports `query_type`, optional `session_id`, optional `mode`, and optional `top_k`.
- `GET /memory/events`
  Authenticated list endpoint with optional `session_id`, `memory_tier`, `event_type`, `mode`, and `limit`.
- `PATCH /memory/events/{eventId}`
  Authenticated partial update for editable fields: `memory_tier`, `event_type`, and `content`. Re-indexes the memory vector.
- `DELETE /memory/events/{eventId}`
  Authenticated delete endpoint. Removes both the structured event and its vector record.

## Evaluation API

- `POST /evaluate_response`
  Authenticated rubric-driven evaluation endpoint. It selects a rubric by mode and role, evaluates the answer, persists an `EvaluationRecord`, writes episodic evaluation memory, and records rubric-derived skill signals for the memory/personalization subsystem.

## Guardrails And Mentor APIs

- `guardrails/policy.yaml`
  Runtime source of truth for guardrail categories, descriptions, severities, labels, and pattern matchers. The app loads this YAML through the policy loader at runtime, and `GUARDRAIL_POLICY_PATH` can override the default file path when needed.
- `GET /flags`
  Mentor/admin-only queue endpoint for flag review.
- `GET /flags/{flagId}`
  Mentor/admin-only detail endpoint for a flagged session, including transcript, evaluations, and prior interventions.
- `PATCH /flags/{flagId}`
  Mentor/admin-only review endpoint for adding mentor notes and marking a flag as reviewed.
- `POST /mentor/feedback`
  Mentor/admin-only endpoint for supplemental mentor coaching. Persists a mentor intervention, writes episodic memory, and emits realtime session and mentor events.
- `POST /mentor/takeover`
  Mentor/admin-only endpoint for live mentor takeover. Pauses the session, moves runtime state into `mentor_review`, persists a mentor intervention, and emits realtime session and mentor events.
- `GET /events/stream`
  Authenticated SSE endpoint. `scope=session&session_id=...` streams guardrail and mentor updates to the active student session. `scope=mentor` streams mentor-queue updates and requires a mentor/admin role.
