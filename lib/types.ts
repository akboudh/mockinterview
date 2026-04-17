export type InterviewMode = "behavioral" | "technical" | "case";
export type SpeakerType = "system" | "interviewer" | "student" | "mentor";
export type MemoryTier = "short_term" | "episodic" | "long_term";
export type UserRole = "student" | "mentor" | "admin";
export type FlagStatus = "open" | "reviewed" | "resolved";
export type SessionStatus = "initialized" | "active" | "paused" | "completed" | "flagged";
export type FlagCategory =
  | "bias"
  | "toxicity"
  | "disallowed_question"
  | "demoralizing_feedback"
  | "safety";
export type QuestionCategory = "primary" | "follow_up" | "situational" | "clarifying";
export type AgentPhase =
  | "interview_setup"
  | "opening"
  | "interview_round"
  | "deep_dive"
  | "session_feedback"
  | "mentor_review";
export type AgentTurnType =
  | "first_turn"
  | "standard"
  | "phase_transition"
  | "clarification"
  | "entity_transition"
  | "termination";
export type AnswerQuality = "limited" | "solid" | "strong";
export type EvaluationDimensionId = "clarity" | "structure" | "relevance" | "soft_skills";
export type StarField = "situation" | "task" | "action" | "result";
export type RubricMatchType = "exact_role_mode" | "mode_default" | "global_default";

export interface UserProfile {
  user_id: string;
  display_name?: string;
  email?: string | null;
  password_hash?: string | null;
  roles?: UserRole[];
  resume_text?: string | null;
  resume_file_name?: string | null;
  target_roles?: string[];
  preferred_modes?: InterviewMode[];
  known_weak_skills?: string[];
  created_at: string;
  updated_at: string;
}

export interface AuthSessionRecord {
  auth_session_id: string;
  user_id: string;
  session_token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface InterviewSession {
  session_id: string;
  user_id: string;
  mode: InterviewMode;
  target_role: string;
  focus_area?: string | null;
  confidence_self_rating?: number | null;
  question_limit?: number | null;
  question_time_limit_seconds?: number | null;
  status: SessionStatus;
  started_at: string;
  ended_at?: string | null;
  personalization_enabled: boolean;
  self_critique_enabled: boolean;
  notes?: string | null;
  resume_text?: string | null;
  recalled_context_summary?: string | null;
}

export interface Message {
  message_id: string;
  session_id: string;
  speaker_type: SpeakerType;
  content: string;
  message_order: number;
  created_at: string;
  meta?: Record<string, unknown>;
}

export interface EvaluationRecord {
  evaluation_id: string;
  session_id: string;
  question_message_id: string;
  answer_message_id: string;
  target_role: string;
  mode: InterviewMode;
  clarity_score: number;
  structure_score: number;
  relevance_score: number;
  soft_skills_score: number;
  star_situation: string;
  star_task: string;
  star_action: string;
  star_result: string;
  overall_summary: string;
  actionable_feedback: string[];
  growth_tips: string[];
  self_critique_output?: string | null;
  rubric_id?: string | null;
  rubric_match_type?: RubricMatchType | null;
  overall_score?: number | null;
  strengths?: string[];
  weak_skills?: string[];
  rubric_coverage?: RubricCoverageAudit | null;
  created_at: string;
}

export interface MemoryEvent {
  event_id: string;
  session_id: string;
  user_id: string;
  memory_tier: MemoryTier;
  event_type: string;
  content: Record<string, unknown>;
  embedding_ref?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface MemoryVectorRecord {
  event_id: string;
  user_id: string;
  session_id: string;
  memory_tier: MemoryTier;
  event_type: string;
  mode?: InterviewMode | null;
  target_role?: string | null;
  focus_area?: string | null;
  embedding_model: string;
  embedding_dimensions: number;
  embedding_text: string;
  vector: number[];
  created_at: string;
  updated_at: string;
}

export interface MemoryListItem extends MemoryEvent {
  mode?: InterviewMode | null;
  target_role?: string | null;
  focus_area?: string | null;
  has_vector: boolean;
}

export interface RecalledContextItem {
  memory_tier: MemoryTier;
  content: Record<string, unknown>;
  relevance_reason: string;
}

export interface SkillSignal {
  skill_signal_id: string;
  user_id: string;
  skill_name: string;
  signal_type: "strength" | "weakness" | "trend";
  source_session_id: string;
  source_evaluation_id: string;
  notes: string;
  created_at: string;
}

export interface FlagEvent {
  flag_id: string;
  session_id: string;
  message_id?: string | null;
  flag_reason: string;
  flag_category: FlagCategory;
  status: FlagStatus;
  mentor_notes?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface GuardrailPolicyRule {
  id: string;
  category: FlagCategory;
  description: string;
  patterns: string[];
  severity?: "low" | "medium" | "high";
  labels?: string[];
}

export interface GuardrailPolicyConfig {
  version: number;
  policies: GuardrailPolicyRule[];
  fallback_behavior: {
    user_message: string;
    mentor_visibility: string;
  };
}

export interface NormalizedGuardrailPolicyRule extends GuardrailPolicyRule {
  severity: "low" | "medium" | "high";
  labels: string[];
  matchers: RegExp[];
}

export interface GuardrailRuntimePolicy {
  version: number;
  policies: NormalizedGuardrailPolicyRule[];
  fallback_behavior: {
    user_message: string;
    mentor_visibility: string;
  };
}

export interface MentorIntervention {
  intervention_id: string;
  session_id: string;
  mentor_message: string;
  intervention_type: "supplemental_feedback";
  created_at: string;
}

/** Async mentor ↔ student messages (outside or about sessions). */
export interface MentorDirectMessage {
  dm_id: string;
  from_user_id: string;
  to_user_id: string;
  session_id: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}

export type RealtimeEventType =
  | "stream.connected"
  | "session.flag.created"
  | "session.flag.reviewed"
  | "session.mentor.feedback"
  | "session.ended"
  | "mentor.dm.new";

export interface RealtimeEventEnvelope {
  event_id: string;
  type: RealtimeEventType;
  session_id?: string | null;
  user_id?: string | null;
  created_at: string;
  audience: "session" | "mentor" | "user";
  payload: Record<string, unknown>;
}

export interface EvaluationDimensionScoreMap {
  clarity: number;
  structure: number;
  relevance: number;
  soft_skills: number;
}

export interface RubricCoverageAudit {
  required_dimensions_checked: EvaluationDimensionId[];
  missing_dimensions: EvaluationDimensionId[];
  star_fields_checked: StarField[];
  missing_star_fields: StarField[];
  uncovered_feedback_areas: string[];
  completeness_score: number;
}

export interface RawEvaluationScorecard {
  clarity_score: number;
  structure_score: number;
  relevance_score: number;
  soft_skills_score: number;
  star: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  overall_summary: string;
  actionable_feedback: string[];
  growth_tips: string[];
  self_critique_output?: string | null;
}

export interface Scorecard extends RawEvaluationScorecard {
  rubric_id: string;
  rubric_match_type: RubricMatchType;
  overall_score: number;
  dimension_scores: EvaluationDimensionScoreMap;
  strengths: string[];
  weak_skills: string[];
  rubric_coverage: RubricCoverageAudit;
}

export interface EvaluationRubricDimension {
  id: EvaluationDimensionId;
  label: string;
  scale_min: number;
  scale_max: number;
  evaluator_prompt: string;
  feedback_priority: number;
  weak_skill_label?: string | null;
  strength_skill_label?: string | null;
  weak_threshold?: number | null;
  strength_threshold?: number | null;
}

export interface EvaluationRubric {
  rubric_id: string;
  version: number;
  mode: InterviewMode | "global";
  description: string;
  role_context: string[];
  dimensions: EvaluationRubricDimension[];
  star_fields: StarField[];
  feedback_priorities: EvaluationDimensionId[];
  weak_skill_threshold: number;
  strength_skill_threshold: number;
}

export interface EvaluationRubricLibrary {
  version: number;
  global_default: EvaluationRubric;
  by_mode: Partial<Record<InterviewMode, EvaluationRubric>>;
}

export interface SelectedEvaluationRubric {
  rubric: EvaluationRubric;
  match_type: RubricMatchType;
  requested_role: string;
  matched_role?: string | null;
}

export interface AnalyzerOutput {
  summary: string;
  answer_quality: AnswerQuality;
  question_type_hint: QuestionCategory;
  follow_up_targets: string[];
  missing_signals: string[];
  suggested_phase: AgentPhase;
  probe_target_skill?: string | null;
  phase_change_reason?: string | null;
  star_coverage?: {
    situation: boolean;
    task: boolean;
    action: boolean;
    result: boolean;
  };
}

export interface AgentSessionState {
  session_id: string;
  user_id: string;
  current_phase: AgentPhase;
  previous_phase?: AgentPhase | null;
  turn_count: number;
  redirect_count: number;
  turn_type: AgentTurnType;
  current_question_id?: string | null;
  current_question_text?: string | null;
  current_question_type?: QuestionCategory | null;
  latest_answer_text?: string | null;
  analyzer_output?: AnalyzerOutput | null;
  missing_signals?: string[];
  follow_up_targets?: string[];
  suggested_phase?: AgentPhase | null;
  conversation_summary?: string | null;
  recent_messages?: Array<{
    speaker_type: SpeakerType;
    content: string;
  }>;
  guardrail_findings?: Array<{
    flag_reason: string;
    flag_category: FlagCategory;
  }>;
  flagged: boolean;
  mentor_takeover_active: boolean;
  state_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummaryRecord {
  summary_id: string;
  session_id: string;
  summary_text: string;
  turn_count: number;
  created_at: string;
}

export interface MockInterviewDB {
  users: UserProfile[];
  authSessions: AuthSessionRecord[];
  sessions: InterviewSession[];
  messages: Message[];
  evaluations: EvaluationRecord[];
  memoryEvents: MemoryEvent[];
  memoryVectors: MemoryVectorRecord[];
  skillSignals: SkillSignal[];
  flags: FlagEvent[];
  mentorInterventions: MentorIntervention[];
  mentorDirectMessages: MentorDirectMessage[];
  agentSessionStates: AgentSessionState[];
  conversationSummaries: ConversationSummaryRecord[];
}

export interface SessionSummary {
  session: InterviewSession;
  /** First name or display name for spoken intro; omitted if unavailable. */
  student_display_name?: string | null;
  messages: Message[];
  evaluations: EvaluationRecord[];
  flags: FlagEvent[];
  mentorInterventions: MentorIntervention[];
  scoreSummary: {
    clarity: number;
    structure: number;
    relevance: number;
    softSkills: number;
    overallAverage: number;
  };
  strengths: string[];
  weaknesses: string[];
  nextSessionRecommendation: string;
  agent_runtime: {
    current_phase: AgentPhase;
    turn_count: number;
    turn_type: AgentTurnType;
    flagged: boolean;
    conversation_summary?: string | null;
  };
}

export interface OrchestratorTranscriptItem {
  speaker_type: SpeakerType;
  content: string;
  question_type?: QuestionCategory | null;
}

export interface AskQuestionContext {
  mode: InterviewMode;
  target_role: string;
  focus_area?: string | null;
  question_limit?: number | null;
  personalization_enabled: boolean;
  self_critique_enabled: boolean;
  resume_text?: string | null;
  recalled_context_summary?: string | null;
  session_status: SessionStatus;
  transcript: OrchestratorTranscriptItem[];
  current_phase: AgentPhase;
  previous_phase?: AgentPhase | null;
  turn_count: number;
  redirect_count?: number;
  turn_type?: AgentTurnType;
  conversation_summary?: string | null;
  weak_skills: string[];
  recalled_context_items: RecalledContextItem[];
  flagged?: boolean;
  mentor_takeover_active?: boolean;
}
