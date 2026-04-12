import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";

import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { DB_PATH } from "@/lib/constants";
import {
  authSessionsTable,
  agentSessionStatesTable,
  conversationSummariesTable,
  evaluationsTable,
  flagsTable,
  memoryEventsTable,
  memoryVectorsTable,
  mentorInterventionsTable,
  messagesTable,
  sessionsTable,
  skillSignalsTable,
  usersTable
} from "@/lib/db-schema";
import type {
  AuthSessionRecord,
  AgentSessionState,
  ConversationSummaryRecord,
  EvaluationRecord,
  FlagEvent,
  MemoryEvent,
  MemoryVectorRecord,
  MentorIntervention,
  Message,
  MockInterviewDB,
  SkillSignal,
  UserProfile,
  InterviewSession
} from "@/lib/types";

const DEFAULT_SQLITE_PATH = "data/mockinterview.sqlite";
const legacyJsonPath = path.join(process.cwd(), DB_PATH);

let sqlite: Database.Database | null = null;
let orm: BetterSQLite3Database | null = null;
let initialized = false;

function emptyDb(): MockInterviewDB {
  return {
    users: [],
    authSessions: [],
    sessions: [],
    messages: [],
    evaluations: [],
    memoryEvents: [],
    memoryVectors: [],
    skillSignals: [],
    flags: [],
    mentorInterventions: [],
    agentSessionStates: [],
    conversationSummaries: []
  };
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toBoolean(value: number) {
  return value === 1;
}

function fromBoolean(value: boolean | null | undefined) {
  return value ? 1 : 0;
}

function getSqlitePath() {
  const configured = process.env.DATABASE_URL?.trim();
  const resolved = configured
    ? configured.startsWith("file:")
      ? configured.slice(5)
      : configured
    : DEFAULT_SQLITE_PATH;

  return path.isAbsolute(resolved) ? resolved : path.join(process.cwd(), resolved);
}

function getSqlite() {
  if (!sqlite) {
    const sqlitePath = getSqlitePath();
    mkdirSync(path.dirname(sqlitePath), { recursive: true });
    sqlite = new Database(sqlitePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }

  return sqlite;
}

export function getOrm() {
  if (!orm) {
    orm = drizzle(getSqlite());
  }

  return orm;
}

export function getDatabaseFilePath() {
  return getSqlitePath();
}

function ensureSchema() {
  const db = getSqlite();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      email TEXT,
      password_hash TEXT,
      roles_json TEXT NOT NULL,
      resume_text TEXT,
      resume_file_name TEXT,
      target_roles_json TEXT NOT NULL,
      preferred_modes_json TEXT NOT NULL,
      known_weak_skills_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      auth_session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions (session_token_hash);

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      target_role TEXT NOT NULL,
      focus_area TEXT,
      confidence_self_rating INTEGER,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      personalization_enabled INTEGER NOT NULL,
      self_critique_enabled INTEGER NOT NULL,
      notes TEXT,
      resume_text TEXT,
      recalled_context_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      speaker_type TEXT NOT NULL,
      content TEXT NOT NULL,
      message_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      meta_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session_order ON messages (session_id, message_order);

    CREATE TABLE IF NOT EXISTS evaluations (
      evaluation_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_message_id TEXT NOT NULL,
      answer_message_id TEXT NOT NULL,
      target_role TEXT NOT NULL,
      mode TEXT NOT NULL,
      clarity_score INTEGER NOT NULL,
      structure_score INTEGER NOT NULL,
      relevance_score INTEGER NOT NULL,
      soft_skills_score INTEGER NOT NULL,
      star_situation TEXT NOT NULL,
      star_task TEXT NOT NULL,
      star_action TEXT NOT NULL,
      star_result TEXT NOT NULL,
      overall_summary TEXT NOT NULL,
      actionable_feedback_json TEXT NOT NULL,
      growth_tips_json TEXT NOT NULL,
      self_critique_output TEXT,
      rubric_id TEXT,
      rubric_match_type TEXT,
      overall_score REAL,
      strengths_json TEXT,
      weak_skills_json TEXT,
      rubric_coverage_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evaluations_session ON evaluations (session_id);

    CREATE TABLE IF NOT EXISTS memory_events (
      event_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      memory_tier TEXT NOT NULL,
      event_type TEXT NOT NULL,
      content_json TEXT NOT NULL,
      embedding_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_memory_user_tier ON memory_events (user_id, memory_tier);

    CREATE TABLE IF NOT EXISTS memory_vectors (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      memory_tier TEXT NOT NULL,
      event_type TEXT NOT NULL,
      mode TEXT,
      target_role TEXT,
      focus_area TEXT,
      embedding_model TEXT NOT NULL,
      embedding_dimensions INTEGER NOT NULL,
      embedding_text TEXT NOT NULL,
      vector_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_vectors_user_tier ON memory_vectors (user_id, memory_tier);
    CREATE INDEX IF NOT EXISTS idx_memory_vectors_session ON memory_vectors (session_id, mode);

    CREATE TABLE IF NOT EXISTS skill_signals (
      skill_signal_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill_name TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      source_session_id TEXT NOT NULL,
      source_evaluation_id TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_skill_user ON skill_signals (user_id, signal_type);

    CREATE TABLE IF NOT EXISTS flags (
      flag_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      message_id TEXT,
      flag_reason TEXT NOT NULL,
      flag_category TEXT NOT NULL,
      status TEXT NOT NULL,
      mentor_notes TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_flags_session ON flags (session_id, status);

    CREATE TABLE IF NOT EXISTS mentor_interventions (
      intervention_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      mentor_message TEXT NOT NULL,
      intervention_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_interventions_session ON mentor_interventions (session_id);

    CREATE TABLE IF NOT EXISTS agent_session_state (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      current_phase TEXT NOT NULL,
      previous_phase TEXT,
      turn_count INTEGER NOT NULL,
      redirect_count INTEGER NOT NULL,
      turn_type TEXT NOT NULL,
      current_question_id TEXT,
      current_question_text TEXT,
      current_question_type TEXT,
      latest_answer_text TEXT,
      analyzer_output_json TEXT,
      missing_signals_json TEXT NOT NULL,
      follow_up_targets_json TEXT NOT NULL,
      suggested_phase TEXT,
      conversation_summary TEXT,
      recent_messages_json TEXT NOT NULL,
      guardrail_findings_json TEXT NOT NULL,
      flagged INTEGER NOT NULL,
      mentor_takeover_active INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_summaries (
      summary_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      turn_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_summaries_session ON conversation_summaries (session_id, created_at);
  `);

  const sessionColumns = (
    db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>
  ).map((column) => column.name);
  const userColumns = (
    db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>
  ).map((column) => column.name);
  const memoryEventColumns = (
    db.prepare("PRAGMA table_info(memory_events)").all() as Array<{ name: string }>
  ).map((column) => column.name);
  const evaluationColumns = (
    db.prepare("PRAGMA table_info(evaluations)").all() as Array<{ name: string }>
  ).map((column) => column.name);

  if (!sessionColumns.includes("resume_text")) {
    db.exec("ALTER TABLE sessions ADD COLUMN resume_text TEXT;");
  }

  if (!userColumns.includes("email")) {
    db.exec("ALTER TABLE users ADD COLUMN email TEXT;");
  }

  if (!userColumns.includes("password_hash")) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
  }

  if (!userColumns.includes("roles_json")) {
    db.exec("ALTER TABLE users ADD COLUMN roles_json TEXT NOT NULL DEFAULT '[]';");
  }

  if (!userColumns.includes("resume_text")) {
    db.exec("ALTER TABLE users ADD COLUMN resume_text TEXT;");
  }

  if (!userColumns.includes("resume_file_name")) {
    db.exec("ALTER TABLE users ADD COLUMN resume_file_name TEXT;");
  }

  if (!memoryEventColumns.includes("updated_at")) {
    db.exec("ALTER TABLE memory_events ADD COLUMN updated_at TEXT;");
  }

  if (!evaluationColumns.includes("rubric_id")) {
    db.exec("ALTER TABLE evaluations ADD COLUMN rubric_id TEXT;");
  }

  if (!evaluationColumns.includes("rubric_match_type")) {
    db.exec("ALTER TABLE evaluations ADD COLUMN rubric_match_type TEXT;");
  }

  if (!evaluationColumns.includes("overall_score")) {
    db.exec("ALTER TABLE evaluations ADD COLUMN overall_score REAL;");
  }

  if (!evaluationColumns.includes("strengths_json")) {
    db.exec("ALTER TABLE evaluations ADD COLUMN strengths_json TEXT;");
  }

  if (!evaluationColumns.includes("weak_skills_json")) {
    db.exec("ALTER TABLE evaluations ADD COLUMN weak_skills_json TEXT;");
  }

  if (!evaluationColumns.includes("rubric_coverage_json")) {
    db.exec("ALTER TABLE evaluations ADD COLUMN rubric_coverage_json TEXT;");
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);");
}

function normalizeDb(nextDb: MockInterviewDB): MockInterviewDB {
  return {
    ...emptyDb(),
    ...nextDb,
    authSessions: nextDb.authSessions ?? [],
    agentSessionStates: nextDb.agentSessionStates ?? [],
    conversationSummaries: nextDb.conversationSummaries ?? [],
    memoryVectors: nextDb.memoryVectors ?? []
  };
}

function buildImportedAgentState(session: InterviewSession, db: MockInterviewDB): AgentSessionState {
  const sessionMessages = db.messages
    .filter((message) => message.session_id === session.session_id)
    .sort((left, right) => left.message_order - right.message_order);
  const interviewerMessages = sessionMessages.filter(
    (message) => message.speaker_type === "interviewer"
  );
  const studentMessages = sessionMessages.filter((message) => message.speaker_type === "student");
  const current_phase =
    session.status === "completed"
      ? "session_feedback"
      : interviewerMessages.length === 0
        ? "interview_setup"
        : studentMessages.length === 0
          ? "opening"
          : "interview_round";

  return {
    session_id: session.session_id,
    user_id: session.user_id,
    current_phase,
    previous_phase: current_phase === "interview_setup" ? null : "interview_setup",
    turn_count: interviewerMessages.length,
    redirect_count: 0,
    turn_type: interviewerMessages.length ? "standard" : "first_turn",
    current_question_id: interviewerMessages.at(-1)?.message_id ?? null,
    current_question_text: interviewerMessages.at(-1)?.content ?? null,
    current_question_type:
      (interviewerMessages.at(-1)?.meta?.question_type as AgentSessionState["current_question_type"]) ??
      (interviewerMessages.length ? "primary" : null),
    latest_answer_text: studentMessages.at(-1)?.content ?? null,
    analyzer_output: null,
    missing_signals: [],
    follow_up_targets: [],
    suggested_phase: current_phase,
    conversation_summary: null,
    recent_messages: sessionMessages.slice(-4).map((message) => ({
      speaker_type: message.speaker_type,
      content: message.content
    })),
    guardrail_findings: [],
    flagged: session.status === "flagged",
    mentor_takeover_active: db.mentorInterventions.some(
      (entry) =>
        entry.session_id === session.session_id && entry.intervention_type === "takeover"
    ),
    state_json: {
      imported_from_json: true,
      current_phase
    },
    created_at: session.started_at,
    updated_at: session.ended_at ?? session.started_at
  };
}

function readLegacySeed(): MockInterviewDB {
  if (!existsSync(legacyJsonPath)) {
    return emptyDb();
  }

  const parsed = JSON.parse(readFileSync(legacyJsonPath, "utf-8")) as Partial<MockInterviewDB>;
  const normalized = normalizeDb(parsed as MockInterviewDB);
  if (!normalized.agentSessionStates.length) {
    normalized.agentSessionStates = normalized.sessions.map((session) =>
      buildImportedAgentState(session, normalized)
    );
  }
  return normalized;
}

async function ensureInitialized() {
  if (initialized) {
    return;
  }

  ensureSchema();

  initialized = true;
}

function mapUsers(rows: Array<Record<string, unknown>>): UserProfile[] {
  return rows.map((row) => ({
    user_id: String(row.user_id),
    display_name: (row.display_name as string | null) ?? undefined,
    email: (row.email as string | null) ?? null,
    password_hash: (row.password_hash as string | null) ?? null,
    roles: fromJson(row.roles_json as string | null, [] as UserProfile["roles"]),
    resume_text: (row.resume_text as string | null) ?? null,
    resume_file_name: (row.resume_file_name as string | null) ?? null,
    target_roles: fromJson(row.target_roles_json as string, [] as string[]),
    preferred_modes: fromJson(row.preferred_modes_json as string, []),
    known_weak_skills: fromJson(row.known_weak_skills_json as string, [] as string[]),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  }));
}

function mapAuthSessions(rows: Array<Record<string, unknown>>): AuthSessionRecord[] {
  return rows.map((row) => ({
    auth_session_id: String(row.auth_session_id),
    user_id: String(row.user_id),
    session_token_hash: String(row.session_token_hash),
    expires_at: String(row.expires_at),
    created_at: String(row.created_at)
  }));
}

function mapSessions(rows: Array<Record<string, unknown>>): InterviewSession[] {
  return rows.map((row) => ({
    session_id: String(row.session_id),
    user_id: String(row.user_id),
    mode: row.mode as InterviewSession["mode"],
    target_role: String(row.target_role),
    focus_area: (row.focus_area as string | null) ?? null,
    confidence_self_rating: (row.confidence_self_rating as number | null) ?? null,
    status: row.status as InterviewSession["status"],
    started_at: String(row.started_at),
    ended_at: (row.ended_at as string | null) ?? null,
    personalization_enabled: toBoolean(row.personalization_enabled as number),
    self_critique_enabled: toBoolean(row.self_critique_enabled as number),
    notes: (row.notes as string | null) ?? null,
    resume_text: (row.resume_text as string | null) ?? null,
    recalled_context_summary: (row.recalled_context_summary as string | null) ?? null
  }));
}

function mapMessages(rows: Array<Record<string, unknown>>): Message[] {
  return rows.map((row) => ({
    message_id: String(row.message_id),
    session_id: String(row.session_id),
    speaker_type: row.speaker_type as Message["speaker_type"],
    content: String(row.content),
    message_order: Number(row.message_order),
    created_at: String(row.created_at),
    meta: fromJson(row.meta_json as string | null, undefined)
  }));
}

function mapEvaluations(rows: Array<Record<string, unknown>>): EvaluationRecord[] {
  return rows.map((row) => ({
    evaluation_id: String(row.evaluation_id),
    session_id: String(row.session_id),
    question_message_id: String(row.question_message_id),
    answer_message_id: String(row.answer_message_id),
    target_role: String(row.target_role),
    mode: row.mode as EvaluationRecord["mode"],
    clarity_score: Number(row.clarity_score),
    structure_score: Number(row.structure_score),
    relevance_score: Number(row.relevance_score),
    soft_skills_score: Number(row.soft_skills_score),
    star_situation: String(row.star_situation),
    star_task: String(row.star_task),
    star_action: String(row.star_action),
    star_result: String(row.star_result),
    overall_summary: String(row.overall_summary),
    actionable_feedback: fromJson(row.actionable_feedback_json as string, [] as string[]),
    growth_tips: fromJson(row.growth_tips_json as string, [] as string[]),
    self_critique_output: (row.self_critique_output as string | null) ?? null,
    rubric_id: (row.rubric_id as string | null) ?? null,
    rubric_match_type: (row.rubric_match_type as EvaluationRecord["rubric_match_type"]) ?? null,
    overall_score:
      typeof row.overall_score === "number" ? row.overall_score : (row.overall_score as number | null) ?? null,
    strengths: fromJson(row.strengths_json as string | null, [] as string[]),
    weak_skills: fromJson(row.weak_skills_json as string | null, [] as string[]),
    rubric_coverage: fromJson(row.rubric_coverage_json as string | null, null),
    created_at: String(row.created_at)
  }));
}

function mapMemoryEvents(rows: Array<Record<string, unknown>>): MemoryEvent[] {
  return rows.map((row) => ({
    event_id: String(row.event_id),
    session_id: String(row.session_id),
    user_id: String(row.user_id),
    memory_tier: row.memory_tier as MemoryEvent["memory_tier"],
    event_type: String(row.event_type),
    content: fromJson(row.content_json as string, {} as Record<string, unknown>),
    embedding_ref: (row.embedding_ref as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: (row.updated_at as string | null) ?? null
  }));
}

function mapMemoryVectors(rows: Array<Record<string, unknown>>): MemoryVectorRecord[] {
  return rows.map((row) => ({
    event_id: String(row.event_id),
    user_id: String(row.user_id),
    session_id: String(row.session_id),
    memory_tier: row.memory_tier as MemoryVectorRecord["memory_tier"],
    event_type: String(row.event_type),
    mode: (row.mode as MemoryVectorRecord["mode"]) ?? null,
    target_role: (row.target_role as string | null) ?? null,
    focus_area: (row.focus_area as string | null) ?? null,
    embedding_model: String(row.embedding_model),
    embedding_dimensions: Number(row.embedding_dimensions),
    embedding_text: String(row.embedding_text),
    vector: fromJson(row.vector_json as string, [] as number[]),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  }));
}

function mapSkillSignals(rows: Array<Record<string, unknown>>): SkillSignal[] {
  return rows.map((row) => ({
    skill_signal_id: String(row.skill_signal_id),
    user_id: String(row.user_id),
    skill_name: String(row.skill_name),
    signal_type: row.signal_type as SkillSignal["signal_type"],
    source_session_id: String(row.source_session_id),
    source_evaluation_id: String(row.source_evaluation_id),
    notes: String(row.notes),
    created_at: String(row.created_at)
  }));
}

function mapFlags(rows: Array<Record<string, unknown>>): FlagEvent[] {
  return rows.map((row) => ({
    flag_id: String(row.flag_id),
    session_id: String(row.session_id),
    message_id: (row.message_id as string | null) ?? null,
    flag_reason: String(row.flag_reason),
    flag_category: row.flag_category as FlagEvent["flag_category"],
    status: row.status as FlagEvent["status"],
    mentor_notes: (row.mentor_notes as string | null) ?? null,
    created_at: String(row.created_at),
    resolved_at: (row.resolved_at as string | null) ?? null
  }));
}

function mapMentorInterventions(rows: Array<Record<string, unknown>>): MentorIntervention[] {
  return rows.map((row) => ({
    intervention_id: String(row.intervention_id),
    session_id: String(row.session_id),
    mentor_message: String(row.mentor_message),
    intervention_type: row.intervention_type as MentorIntervention["intervention_type"],
    created_at: String(row.created_at)
  }));
}

function mapAgentStates(rows: Array<Record<string, unknown>>): AgentSessionState[] {
  return rows.map((row) => ({
    session_id: String(row.session_id),
    user_id: String(row.user_id),
    current_phase: row.current_phase as AgentSessionState["current_phase"],
    previous_phase: (row.previous_phase as AgentSessionState["previous_phase"]) ?? null,
    turn_count: Number(row.turn_count),
    redirect_count: Number(row.redirect_count),
    turn_type: row.turn_type as AgentSessionState["turn_type"],
    current_question_id: (row.current_question_id as string | null) ?? null,
    current_question_text: (row.current_question_text as string | null) ?? null,
    current_question_type:
      (row.current_question_type as AgentSessionState["current_question_type"]) ?? null,
    latest_answer_text: (row.latest_answer_text as string | null) ?? null,
    analyzer_output: fromJson(row.analyzer_output_json as string | null, null),
    missing_signals: fromJson(row.missing_signals_json as string, [] as string[]),
    follow_up_targets: fromJson(row.follow_up_targets_json as string, [] as string[]),
    suggested_phase: (row.suggested_phase as AgentSessionState["suggested_phase"]) ?? null,
    conversation_summary: (row.conversation_summary as string | null) ?? null,
    recent_messages: fromJson(row.recent_messages_json as string, []),
    guardrail_findings: fromJson(row.guardrail_findings_json as string, []),
    flagged: toBoolean(row.flagged as number),
    mentor_takeover_active: toBoolean(row.mentor_takeover_active as number),
    state_json: fromJson(row.state_json as string, {} as Record<string, unknown>),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  }));
}

function mapConversationSummaries(rows: Array<Record<string, unknown>>): ConversationSummaryRecord[] {
  return rows.map((row) => ({
    summary_id: String(row.summary_id),
    session_id: String(row.session_id),
    summary_text: String(row.summary_text),
    turn_count: Number(row.turn_count),
    created_at: String(row.created_at)
  }));
}

export async function readDb(): Promise<MockInterviewDB> {
  await ensureInitialized();
  const db = getOrm();

  const users = mapUsers(db.select().from(usersTable).all() as Array<Record<string, unknown>>);
  const authSessions = mapAuthSessions(
    db.select().from(authSessionsTable).all() as Array<Record<string, unknown>>
  );
  const sessions = mapSessions(
    db.select().from(sessionsTable).all() as Array<Record<string, unknown>>
  );
  const messages = mapMessages(
    db.select().from(messagesTable).all() as Array<Record<string, unknown>>
  );
  const evaluations = mapEvaluations(
    db.select().from(evaluationsTable).all() as Array<Record<string, unknown>>
  );
  const memoryEvents = mapMemoryEvents(
    db.select().from(memoryEventsTable).all() as Array<Record<string, unknown>>
  );
  const memoryVectors = mapMemoryVectors(
    db.select().from(memoryVectorsTable).all() as Array<Record<string, unknown>>
  );
  const skillSignals = mapSkillSignals(
    db.select().from(skillSignalsTable).all() as Array<Record<string, unknown>>
  );
  const flags = mapFlags(db.select().from(flagsTable).all() as Array<Record<string, unknown>>);
  const mentorInterventions = mapMentorInterventions(
    db.select().from(mentorInterventionsTable).all() as Array<Record<string, unknown>>
  );
  const agentSessionStates = mapAgentStates(
    db.select().from(agentSessionStatesTable).all() as Array<Record<string, unknown>>
  );
  const conversationSummaries = mapConversationSummaries(
    db.select().from(conversationSummariesTable).all() as Array<Record<string, unknown>>
  );

  return {
    users,
    authSessions,
    sessions,
    messages,
    evaluations,
    memoryEvents,
    memoryVectors,
    skillSignals,
    flags,
    mentorInterventions,
    agentSessionStates,
    conversationSummaries
  };
}

function clearAllTables(tx: BetterSQLite3Database) {
  tx.delete(conversationSummariesTable).run();
  tx.delete(agentSessionStatesTable).run();
  tx.delete(mentorInterventionsTable).run();
  tx.delete(flagsTable).run();
  tx.delete(skillSignalsTable).run();
  tx.delete(memoryVectorsTable).run();
  tx.delete(memoryEventsTable).run();
  tx.delete(evaluationsTable).run();
  tx.delete(messagesTable).run();
  tx.delete(sessionsTable).run();
  tx.delete(authSessionsTable).run();
  tx.delete(usersTable).run();
}

export async function writeDb(nextDb: MockInterviewDB) {
  await ensureInitialized();
  const db = getOrm();
  const normalized = normalizeDb(nextDb);

  db.transaction((tx) => {
    clearAllTables(tx);

    if (normalized.users.length) {
      tx.insert(usersTable)
        .values(
          normalized.users.map((user) => ({
            user_id: user.user_id,
            display_name: user.display_name ?? null,
            email: user.email?.toLowerCase() ?? null,
            password_hash: user.password_hash ?? null,
            roles_json: toJson(user.roles ?? []),
            resume_text: user.resume_text ?? null,
            resume_file_name: user.resume_file_name ?? null,
            target_roles_json: toJson(user.target_roles ?? []),
            preferred_modes_json: toJson(user.preferred_modes ?? []),
            known_weak_skills_json: toJson(user.known_weak_skills ?? []),
            created_at: user.created_at,
            updated_at: user.updated_at
          }))
        )
        .run();
    }

    if (normalized.authSessions.length) {
      tx.insert(authSessionsTable)
        .values(
          normalized.authSessions.map((session) => ({
            auth_session_id: session.auth_session_id,
            user_id: session.user_id,
            session_token_hash: session.session_token_hash,
            expires_at: session.expires_at,
            created_at: session.created_at
          }))
        )
        .run();
    }

    if (normalized.sessions.length) {
      tx.insert(sessionsTable)
        .values(
          normalized.sessions.map((session) => ({
            session_id: session.session_id,
            user_id: session.user_id,
            mode: session.mode,
            target_role: session.target_role,
            focus_area: session.focus_area ?? null,
            confidence_self_rating: session.confidence_self_rating ?? null,
            status: session.status,
            started_at: session.started_at,
            ended_at: session.ended_at ?? null,
            personalization_enabled: fromBoolean(session.personalization_enabled),
            self_critique_enabled: fromBoolean(session.self_critique_enabled),
            notes: session.notes ?? null,
            resume_text: session.resume_text ?? null,
            recalled_context_summary: session.recalled_context_summary ?? null
          }))
        )
        .run();
    }

    if (normalized.messages.length) {
      tx.insert(messagesTable)
        .values(
          normalized.messages.map((message) => ({
            message_id: message.message_id,
            session_id: message.session_id,
            speaker_type: message.speaker_type,
            content: message.content,
            message_order: message.message_order,
            created_at: message.created_at,
            meta_json: message.meta ? toJson(message.meta) : null
          }))
        )
        .run();
    }

    if (normalized.evaluations.length) {
      tx.insert(evaluationsTable)
        .values(
          normalized.evaluations.map((evaluation) => ({
            evaluation_id: evaluation.evaluation_id,
            session_id: evaluation.session_id,
            question_message_id: evaluation.question_message_id,
            answer_message_id: evaluation.answer_message_id,
            target_role: evaluation.target_role,
            mode: evaluation.mode,
            clarity_score: evaluation.clarity_score,
            structure_score: evaluation.structure_score,
            relevance_score: evaluation.relevance_score,
            soft_skills_score: evaluation.soft_skills_score,
            star_situation: evaluation.star_situation,
            star_task: evaluation.star_task,
            star_action: evaluation.star_action,
            star_result: evaluation.star_result,
            overall_summary: evaluation.overall_summary,
            actionable_feedback_json: toJson(evaluation.actionable_feedback),
            growth_tips_json: toJson(evaluation.growth_tips),
            self_critique_output: evaluation.self_critique_output ?? null,
            rubric_id: evaluation.rubric_id ?? null,
            rubric_match_type: evaluation.rubric_match_type ?? null,
            overall_score: evaluation.overall_score ?? null,
            strengths_json: toJson(evaluation.strengths ?? []),
            weak_skills_json: toJson(evaluation.weak_skills ?? []),
            rubric_coverage_json: toJson(evaluation.rubric_coverage ?? null),
            created_at: evaluation.created_at
          }))
        )
        .run();
    }

    if (normalized.memoryEvents.length) {
      tx.insert(memoryEventsTable)
        .values(
          normalized.memoryEvents.map((event) => ({
            event_id: event.event_id,
            session_id: event.session_id,
            user_id: event.user_id,
            memory_tier: event.memory_tier,
            event_type: event.event_type,
            content_json: toJson(event.content),
            embedding_ref: event.embedding_ref ?? null,
            created_at: event.created_at,
            updated_at: event.updated_at ?? event.created_at
          }))
        )
        .run();
    }

    if (normalized.memoryVectors.length) {
      tx.insert(memoryVectorsTable)
        .values(
          normalized.memoryVectors.map((vector) => ({
            event_id: vector.event_id,
            user_id: vector.user_id,
            session_id: vector.session_id,
            memory_tier: vector.memory_tier,
            event_type: vector.event_type,
            mode: vector.mode ?? null,
            target_role: vector.target_role ?? null,
            focus_area: vector.focus_area ?? null,
            embedding_model: vector.embedding_model,
            embedding_dimensions: vector.embedding_dimensions,
            embedding_text: vector.embedding_text,
            vector_json: toJson(vector.vector),
            created_at: vector.created_at,
            updated_at: vector.updated_at
          }))
        )
        .run();
    }

    if (normalized.skillSignals.length) {
      tx.insert(skillSignalsTable)
        .values(
          normalized.skillSignals.map((signal) => ({
            skill_signal_id: signal.skill_signal_id,
            user_id: signal.user_id,
            skill_name: signal.skill_name,
            signal_type: signal.signal_type,
            source_session_id: signal.source_session_id,
            source_evaluation_id: signal.source_evaluation_id,
            notes: signal.notes,
            created_at: signal.created_at
          }))
        )
        .run();
    }

    if (normalized.flags.length) {
      tx.insert(flagsTable)
        .values(
          normalized.flags.map((flag) => ({
            flag_id: flag.flag_id,
            session_id: flag.session_id,
            message_id: flag.message_id ?? null,
            flag_reason: flag.flag_reason,
            flag_category: flag.flag_category,
            status: flag.status,
            mentor_notes: flag.mentor_notes ?? null,
            created_at: flag.created_at,
            resolved_at: flag.resolved_at ?? null
          }))
        )
        .run();
    }

    if (normalized.mentorInterventions.length) {
      tx.insert(mentorInterventionsTable)
        .values(
          normalized.mentorInterventions.map((intervention) => ({
            intervention_id: intervention.intervention_id,
            session_id: intervention.session_id,
            mentor_message: intervention.mentor_message,
            intervention_type: intervention.intervention_type,
            created_at: intervention.created_at
          }))
        )
        .run();
    }

    if (normalized.agentSessionStates.length) {
      tx.insert(agentSessionStatesTable)
        .values(
          normalized.agentSessionStates.map((state) => ({
            session_id: state.session_id,
            user_id: state.user_id,
            current_phase: state.current_phase,
            previous_phase: state.previous_phase ?? null,
            turn_count: state.turn_count,
            redirect_count: state.redirect_count,
            turn_type: state.turn_type,
            current_question_id: state.current_question_id ?? null,
            current_question_text: state.current_question_text ?? null,
            current_question_type: state.current_question_type ?? null,
            latest_answer_text: state.latest_answer_text ?? null,
            analyzer_output_json: state.analyzer_output ? toJson(state.analyzer_output) : null,
            missing_signals_json: toJson(state.missing_signals ?? []),
            follow_up_targets_json: toJson(state.follow_up_targets ?? []),
            suggested_phase: state.suggested_phase ?? null,
            conversation_summary: state.conversation_summary ?? null,
            recent_messages_json: toJson(state.recent_messages ?? []),
            guardrail_findings_json: toJson(state.guardrail_findings ?? []),
            flagged: fromBoolean(state.flagged),
            mentor_takeover_active: fromBoolean(state.mentor_takeover_active),
            state_json: toJson(state.state_json ?? {}),
            created_at: state.created_at,
            updated_at: state.updated_at
          }))
        )
        .run();
    }

    if (normalized.conversationSummaries.length) {
      tx.insert(conversationSummariesTable)
        .values(
          normalized.conversationSummaries.map((summary) => ({
            summary_id: summary.summary_id,
            session_id: summary.session_id,
            summary_text: summary.summary_text,
            turn_count: summary.turn_count,
            created_at: summary.created_at
          }))
        )
        .run();
    }
  });
}

export async function updateDb(
  updater: (db: MockInterviewDB) => MockInterviewDB | Promise<MockInterviewDB>
) {
  await ensureInitialized();
  const current = await readDb();
  const updated = await updater(current);
  await writeDb(updated);
  return updated;
}

export async function resetSqliteFromJson() {
  initialized = false;
  await writeDb(readLegacySeed());
}

export async function clearDb() {
  initialized = false;
  await writeDb(emptyDb());
}
