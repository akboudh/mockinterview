import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import {
  agentSessionStatesTable,
  conversationSummariesTable,
  messagesTable,
  sessionsTable,
  usersTable
} from "@/lib/db-schema";
import { fromBoolean, fromJson, runIncrementalTransaction, toJson } from "@/lib/db";
import type {
  AgentSessionState,
  ConversationSummaryRecord,
  InterviewMode,
  InterviewSession,
  Message,
  SessionStatus,
  UserProfile
} from "@/lib/types";

function mapUserRow(row: Record<string, unknown>): UserProfile {
  return {
    user_id: String(row.user_id),
    display_name: (row.display_name as string | null) ?? undefined,
    email: (row.email as string | null) ?? null,
    password_hash: (row.password_hash as string | null) ?? null,
    roles: fromJson(row.roles_json as string | null, [] as UserProfile["roles"]),
    resume_text: (row.resume_text as string | null) ?? null,
    resume_file_name: (row.resume_file_name as string | null) ?? null,
    target_roles: fromJson(row.target_roles_json as string | null, [] as string[]),
    preferred_modes: fromJson(row.preferred_modes_json as string | null, [] as InterviewMode[]),
    known_weak_skills: fromJson(row.known_weak_skills_json as string | null, [] as string[]),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function replaceAgentStateRow(tx: BetterSQLite3Database, state: AgentSessionState) {
  tx.delete(agentSessionStatesTable)
    .where(eq(agentSessionStatesTable.session_id, state.session_id))
    .run();
  tx.insert(agentSessionStatesTable)
    .values({
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
    })
    .run();
}

export async function incrementalStartSession(params: {
  session: InterviewSession;
  runtimeState: AgentSessionState;
  userId: string;
  normalizedResumeText: string;
  targetRole: string;
  mode: InterviewMode;
}) {
  await runIncrementalTransaction((tx) => {
    const userRows = tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.user_id, params.userId))
      .all() as Array<Record<string, unknown>>;

    if (userRows.length) {
      const user = mapUserRow(userRows[0]!);
      tx.update(usersTable)
        .set({
          resume_text: (params.normalizedResumeText || user.resume_text) ?? null,
          target_roles_json: toJson(
            Array.from(new Set([...(user.target_roles ?? []), params.targetRole]))
          ),
          preferred_modes_json: toJson(
            Array.from(new Set([...(user.preferred_modes ?? []), params.mode]))
          ),
          updated_at: new Date().toISOString()
        })
        .where(eq(usersTable.user_id, params.userId))
        .run();
    } else {
      tx.insert(usersTable)
        .values({
          user_id: params.userId,
          display_name: "Career-Ready Student",
          email: null,
          password_hash: null,
          roles_json: toJson([]),
          resume_text: params.normalizedResumeText || null,
          resume_file_name: null,
          target_roles_json: toJson([params.targetRole]),
          preferred_modes_json: toJson([params.mode]),
          known_weak_skills_json: toJson([]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .run();
    }

    tx.insert(sessionsTable)
      .values({
        session_id: params.session.session_id,
        user_id: params.session.user_id,
        mode: params.session.mode,
        target_role: params.session.target_role,
        focus_area: params.session.focus_area ?? null,
        confidence_self_rating: params.session.confidence_self_rating ?? null,
        question_limit: params.session.question_limit ?? null,
        question_time_limit_seconds: params.session.question_time_limit_seconds ?? null,
        status: params.session.status,
        started_at: params.session.started_at,
        ended_at: params.session.ended_at ?? null,
        personalization_enabled: fromBoolean(params.session.personalization_enabled),
        self_critique_enabled: fromBoolean(params.session.self_critique_enabled),
        notes: params.session.notes ?? null,
        resume_text: params.session.resume_text ?? null,
        recalled_context_summary: params.session.recalled_context_summary ?? null
      })
      .run();

    replaceAgentStateRow(tx, params.runtimeState);
  });
}

export async function incrementalSaveStudentAnswer(params: {
  message: Message;
  sessionId: string;
  sessionStatus: SessionStatus;
  nextAgentState: AgentSessionState;
}) {
  await runIncrementalTransaction((tx) => {
    tx.insert(messagesTable)
      .values({
        message_id: params.message.message_id,
        session_id: params.message.session_id,
        speaker_type: params.message.speaker_type,
        content: params.message.content,
        message_order: params.message.message_order,
        created_at: params.message.created_at,
        meta_json: params.message.meta ? toJson(params.message.meta) : null
      })
      .run();

    tx.update(sessionsTable)
      .set({ status: params.sessionStatus })
      .where(eq(sessionsTable.session_id, params.sessionId))
      .run();

    replaceAgentStateRow(tx, params.nextAgentState);
  });
}

/**
 * Prepend an opening interviewer message at order 1; shifts existing messages' orders up by 1.
 */
export async function incrementalPrependOpeningMessage(params: { sessionId: string; message: Message }) {
  await runIncrementalTransaction((tx) => {
    const rows = tx
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.session_id, params.sessionId))
      .all() as Array<{ message_id: string; message_order: number }>;

    for (const row of rows.sort((left, right) => right.message_order - left.message_order)) {
      tx.update(messagesTable)
        .set({ message_order: row.message_order + 1 })
        .where(eq(messagesTable.message_id, row.message_id))
        .run();
    }

    tx.insert(messagesTable)
      .values({
        message_id: params.message.message_id,
        session_id: params.message.session_id,
        speaker_type: params.message.speaker_type,
        content: params.message.content,
        message_order: params.message.message_order,
        created_at: params.message.created_at,
        meta_json: params.message.meta ? toJson(params.message.meta) : null
      })
      .run();
  });
}

export async function incrementalAppendTranscriptMessage(params: {
  message: Message;
  nextAgentState: AgentSessionState;
}) {
  await runIncrementalTransaction((tx) => {
    tx.insert(messagesTable)
      .values({
        message_id: params.message.message_id,
        session_id: params.message.session_id,
        speaker_type: params.message.speaker_type,
        content: params.message.content,
        message_order: params.message.message_order,
        created_at: params.message.created_at,
        meta_json: params.message.meta ? toJson(params.message.meta) : null
      })
      .run();
    replaceAgentStateRow(tx, params.nextAgentState);
  });
}

export async function incrementalSetSessionStatus(sessionId: string, status: SessionStatus) {
  await runIncrementalTransaction((tx) => {
    tx.update(sessionsTable).set({ status }).where(eq(sessionsTable.session_id, sessionId)).run();
  });
}

export async function incrementalEndSession(
  sessionId: string,
  endedAt: string | null | undefined,
  nextAgentState: AgentSessionState
) {
  await runIncrementalTransaction((tx) => {
    tx.update(sessionsTable)
      .set({
        status: "completed",
        ended_at: endedAt ?? new Date().toISOString()
      })
      .where(eq(sessionsTable.session_id, sessionId))
      .run();

    replaceAgentStateRow(tx, nextAgentState);
  });
}

export async function incrementalPersistAskQuestion(params: {
  message: Message;
  session: InterviewSession;
  nextRuntimeState: AgentSessionState;
  summaryRecord: ConversationSummaryRecord | null;
  findingsLength: number;
}) {
  await runIncrementalTransaction((tx) => {
    const sessionFeedback =
      params.nextRuntimeState.current_phase === "session_feedback";
    const status: SessionStatus = sessionFeedback
      ? "completed"
      : params.findingsLength > 0
        ? "flagged"
        : "active";
    const endedAt = sessionFeedback
      ? params.session.ended_at ?? new Date().toISOString()
      : params.session.ended_at ?? null;

    tx.insert(messagesTable)
      .values({
        message_id: params.message.message_id,
        session_id: params.message.session_id,
        speaker_type: params.message.speaker_type,
        content: params.message.content,
        message_order: params.message.message_order,
        created_at: params.message.created_at,
        meta_json: params.message.meta ? toJson(params.message.meta) : null
      })
      .run();

    tx.update(sessionsTable)
      .set({
        status,
        ended_at: endedAt
      })
      .where(eq(sessionsTable.session_id, params.session.session_id))
      .run();

    replaceAgentStateRow(tx, params.nextRuntimeState);

    if (params.summaryRecord) {
      tx.insert(conversationSummariesTable)
        .values({
          summary_id: params.summaryRecord.summary_id,
          session_id: params.summaryRecord.session_id,
          summary_text: params.summaryRecord.summary_text,
          turn_count: params.summaryRecord.turn_count,
          created_at: params.summaryRecord.created_at
        })
        .run();
    }
  });
}
