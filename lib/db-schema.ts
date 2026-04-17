import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  user_id: text("user_id").primaryKey(),
  display_name: text("display_name"),
  email: text("email"),
  password_hash: text("password_hash"),
  roles_json: text("roles_json").notNull(),
  resume_text: text("resume_text"),
  resume_file_name: text("resume_file_name"),
  target_roles_json: text("target_roles_json").notNull(),
  preferred_modes_json: text("preferred_modes_json").notNull(),
  known_weak_skills_json: text("known_weak_skills_json").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull()
});

export const authSessionsTable = sqliteTable("auth_sessions", {
  auth_session_id: text("auth_session_id").primaryKey(),
  user_id: text("user_id").notNull(),
  session_token_hash: text("session_token_hash").notNull(),
  expires_at: text("expires_at").notNull(),
  created_at: text("created_at").notNull()
});

export const sessionsTable = sqliteTable("sessions", {
  session_id: text("session_id").primaryKey(),
  user_id: text("user_id").notNull(),
  mode: text("mode").notNull(),
  target_role: text("target_role").notNull(),
  focus_area: text("focus_area"),
  confidence_self_rating: integer("confidence_self_rating"),
  question_limit: integer("question_limit"),
  question_time_limit_seconds: integer("question_time_limit_seconds"),
  status: text("status").notNull(),
  started_at: text("started_at").notNull(),
  ended_at: text("ended_at"),
  personalization_enabled: integer("personalization_enabled").notNull(),
  self_critique_enabled: integer("self_critique_enabled").notNull(),
  notes: text("notes"),
  resume_text: text("resume_text"),
  recalled_context_summary: text("recalled_context_summary")
});

export const messagesTable = sqliteTable("messages", {
  message_id: text("message_id").primaryKey(),
  session_id: text("session_id").notNull(),
  speaker_type: text("speaker_type").notNull(),
  content: text("content").notNull(),
  message_order: integer("message_order").notNull(),
  created_at: text("created_at").notNull(),
  meta_json: text("meta_json")
});

export const evaluationsTable = sqliteTable("evaluations", {
  evaluation_id: text("evaluation_id").primaryKey(),
  session_id: text("session_id").notNull(),
  question_message_id: text("question_message_id").notNull(),
  answer_message_id: text("answer_message_id").notNull(),
  target_role: text("target_role").notNull(),
  mode: text("mode").notNull(),
  clarity_score: integer("clarity_score").notNull(),
  structure_score: integer("structure_score").notNull(),
  relevance_score: integer("relevance_score").notNull(),
  soft_skills_score: integer("soft_skills_score").notNull(),
  star_situation: text("star_situation").notNull(),
  star_task: text("star_task").notNull(),
  star_action: text("star_action").notNull(),
  star_result: text("star_result").notNull(),
  overall_summary: text("overall_summary").notNull(),
  actionable_feedback_json: text("actionable_feedback_json").notNull(),
  growth_tips_json: text("growth_tips_json").notNull(),
  self_critique_output: text("self_critique_output"),
  rubric_id: text("rubric_id"),
  rubric_match_type: text("rubric_match_type"),
  overall_score: real("overall_score"),
  strengths_json: text("strengths_json"),
  weak_skills_json: text("weak_skills_json"),
  rubric_coverage_json: text("rubric_coverage_json"),
  created_at: text("created_at").notNull()
});

export const memoryEventsTable = sqliteTable("memory_events", {
  event_id: text("event_id").primaryKey(),
  session_id: text("session_id").notNull(),
  user_id: text("user_id").notNull(),
  memory_tier: text("memory_tier").notNull(),
  event_type: text("event_type").notNull(),
  content_json: text("content_json").notNull(),
  embedding_ref: text("embedding_ref"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at")
});

export const memoryVectorsTable = sqliteTable("memory_vectors", {
  event_id: text("event_id").primaryKey(),
  user_id: text("user_id").notNull(),
  session_id: text("session_id").notNull(),
  memory_tier: text("memory_tier").notNull(),
  event_type: text("event_type").notNull(),
  mode: text("mode"),
  target_role: text("target_role"),
  focus_area: text("focus_area"),
  embedding_model: text("embedding_model").notNull(),
  embedding_dimensions: integer("embedding_dimensions").notNull(),
  embedding_text: text("embedding_text").notNull(),
  vector_json: text("vector_json").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull()
});

export const skillSignalsTable = sqliteTable("skill_signals", {
  skill_signal_id: text("skill_signal_id").primaryKey(),
  user_id: text("user_id").notNull(),
  skill_name: text("skill_name").notNull(),
  signal_type: text("signal_type").notNull(),
  source_session_id: text("source_session_id").notNull(),
  source_evaluation_id: text("source_evaluation_id").notNull(),
  notes: text("notes").notNull(),
  created_at: text("created_at").notNull()
});

export const flagsTable = sqliteTable("flags", {
  flag_id: text("flag_id").primaryKey(),
  session_id: text("session_id").notNull(),
  message_id: text("message_id"),
  flag_reason: text("flag_reason").notNull(),
  flag_category: text("flag_category").notNull(),
  status: text("status").notNull(),
  mentor_notes: text("mentor_notes"),
  created_at: text("created_at").notNull(),
  resolved_at: text("resolved_at")
});

export const mentorInterventionsTable = sqliteTable("mentor_interventions", {
  intervention_id: text("intervention_id").primaryKey(),
  session_id: text("session_id").notNull(),
  mentor_message: text("mentor_message").notNull(),
  intervention_type: text("intervention_type").notNull(),
  created_at: text("created_at").notNull()
});

export const mentorDirectMessagesTable = sqliteTable("mentor_direct_messages", {
  dm_id: text("dm_id").primaryKey(),
  from_user_id: text("from_user_id").notNull(),
  to_user_id: text("to_user_id").notNull(),
  session_id: text("session_id"),
  body: text("body").notNull(),
  created_at: text("created_at").notNull(),
  read_at: text("read_at")
});

export const agentSessionStatesTable = sqliteTable("agent_session_state", {
  session_id: text("session_id").primaryKey(),
  user_id: text("user_id").notNull(),
  current_phase: text("current_phase").notNull(),
  previous_phase: text("previous_phase"),
  turn_count: integer("turn_count").notNull(),
  redirect_count: integer("redirect_count").notNull(),
  turn_type: text("turn_type").notNull(),
  current_question_id: text("current_question_id"),
  current_question_text: text("current_question_text"),
  current_question_type: text("current_question_type"),
  latest_answer_text: text("latest_answer_text"),
  analyzer_output_json: text("analyzer_output_json"),
  missing_signals_json: text("missing_signals_json").notNull(),
  follow_up_targets_json: text("follow_up_targets_json").notNull(),
  suggested_phase: text("suggested_phase"),
  conversation_summary: text("conversation_summary"),
  recent_messages_json: text("recent_messages_json").notNull(),
  guardrail_findings_json: text("guardrail_findings_json").notNull(),
  flagged: integer("flagged").notNull(),
  mentor_takeover_active: integer("mentor_takeover_active").notNull(),
  state_json: text("state_json").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull()
});

export const conversationSummariesTable = sqliteTable("conversation_summaries", {
  summary_id: text("summary_id").primaryKey(),
  session_id: text("session_id").notNull(),
  summary_text: text("summary_text").notNull(),
  turn_count: integer("turn_count").notNull(),
  created_at: text("created_at").notNull()
});
