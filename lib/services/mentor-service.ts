import { incrementalAppendTranscriptMessage } from "@/lib/db-incremental";
import { readDb, updateDb } from "@/lib/db";
import { logEvent } from "@/lib/logging";
import { publishRealtimeEvent } from "@/lib/realtime/event-bus";
import { saveEvent } from "@/lib/services/memory-service";
import type { AgentSessionState, Message } from "@/lib/types";

interface MentorServiceDeps {
  readDb: typeof readDb;
  updateDb: typeof updateDb;
  saveEvent: typeof saveEvent;
  publishRealtimeEvent: typeof publishRealtimeEvent;
  now: () => string;
  randomUUID: () => string;
}

function withMentorDeps(overrides: Partial<MentorServiceDeps> = {}): MentorServiceDeps {
  return {
    readDb,
    updateDb,
    saveEvent,
    publishRealtimeEvent,
    now: () => new Date().toISOString(),
    randomUUID: () => crypto.randomUUID(),
    ...overrides
  };
}

export async function listFlags() {
  const db = await readDb();

  return db.flags
    .map((flag) => {
      const session = db.sessions.find((entry) => entry.session_id === flag.session_id);
      return {
        ...flag,
        mode: session?.mode ?? "behavioral",
        target_role: session?.target_role ?? "Unknown role",
        session_status: session?.status ?? "initialized"
      };
    })
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
}

export async function getFlagDetail(flagId: string) {
  const db = await readDb();
  const flag = db.flags.find((entry) => entry.flag_id === flagId);

  if (!flag) {
    throw new Error("Flag not found.");
  }

  const session = db.sessions.find((entry) => entry.session_id === flag.session_id);
  const transcript = db.messages
    .filter((entry) => entry.session_id === flag.session_id)
    .sort((left, right) => left.message_order - right.message_order);
  const evaluations = db.evaluations.filter(
    (entry) => entry.session_id === flag.session_id
  );
  const interventions = db.mentorInterventions.filter(
    (entry) => entry.session_id === flag.session_id
  );

  return {
    flag,
    session,
    transcript,
    evaluations,
    interventions
  };
}

export async function addMentorFeedback(params: {
  session_id: string;
  mentor_message: string;
}, deps: Partial<MentorServiceDeps> = {}) {
  const resolvedDeps = withMentorDeps(deps);
  const createdAt = resolvedDeps.now();
  const intervention = {
    intervention_id: resolvedDeps.randomUUID(),
    session_id: params.session_id,
    mentor_message: params.mentor_message,
    intervention_type: "supplemental_feedback" as const,
    created_at: createdAt
  };

  await resolvedDeps.updateDb((db) => ({
    ...db,
    mentorInterventions: [...db.mentorInterventions, intervention],
    agentSessionStates: db.agentSessionStates.map((state) =>
      state.session_id === params.session_id
        ? {
            ...state,
            updated_at: createdAt,
            state_json: {
              ...state.state_json,
              mentor_feedback_count:
                Number((state.state_json.mentor_feedback_count as number | undefined) ?? 0) + 1
            }
          }
        : state
    )
  }));

  const db = await resolvedDeps.readDb();
  const userId =
    db.sessions.find((session) => session.session_id === params.session_id)?.user_id ??
    "demo-student";

  await resolvedDeps.saveEvent({
    session_id: params.session_id,
    user_id: userId,
    memory_tier: "episodic",
    event_type: "mentor_feedback",
    content: intervention
  });

  resolvedDeps.publishRealtimeEvent({
    event_id: resolvedDeps.randomUUID(),
    type: "session.mentor.feedback",
    session_id: params.session_id,
    user_id: userId,
    audience: "session",
    created_at: resolvedDeps.now(),
    payload: intervention
  });
  resolvedDeps.publishRealtimeEvent({
    event_id: resolvedDeps.randomUUID(),
    type: "session.mentor.feedback",
    session_id: params.session_id,
    user_id: userId,
    audience: "mentor",
    created_at: resolvedDeps.now(),
    payload: intervention
  });

  logEvent("mentor.feedback.submitted", {
    session_id: params.session_id,
    intervention_id: intervention.intervention_id
  });

  return intervention;
}

export async function takeOverSession(params: {
  session_id: string;
  mentor_message: string;
}, deps: Partial<MentorServiceDeps> = {}) {
  throw new Error("Live takeover has been removed.");
}

export async function markFlagReviewed(
  params: { flag_id: string; mentor_notes?: string | null },
  deps: Partial<MentorServiceDeps> = {}
) {
  const resolvedDeps = withMentorDeps(deps);
  const dbBefore = await resolvedDeps.readDb();
  const targetFlag = dbBefore.flags.find((entry) => entry.flag_id === params.flag_id) ?? null;
  const userId =
    (targetFlag &&
      dbBefore.sessions.find((session) => session.session_id === targetFlag.session_id)?.user_id) ??
    null;

  await resolvedDeps.updateDb((db) => ({
    ...db,
    flags: db.flags.map((flag) =>
      flag.flag_id === params.flag_id
        ? {
            ...flag,
            status: "reviewed",
            mentor_notes: params.mentor_notes ?? flag.mentor_notes ?? null
          }
        : flag
    ),
    agentSessionStates: db.agentSessionStates.map((state) => {
      const flag = db.flags.find((entry) => entry.flag_id === params.flag_id);
      if (!flag || state.session_id !== flag.session_id) {
        return state;
      }

      return {
        ...state,
        updated_at: resolvedDeps.now(),
        state_json: {
          ...state.state_json,
          latest_flag_review_note: params.mentor_notes ?? null
        }
      };
    })
  }));

  if (targetFlag) {
    resolvedDeps.publishRealtimeEvent({
      event_id: resolvedDeps.randomUUID(),
      type: "session.flag.reviewed",
      session_id: targetFlag.session_id,
      user_id: userId,
      audience: "mentor",
      created_at: resolvedDeps.now(),
      payload: {
        flag_id: targetFlag.flag_id,
        status: "reviewed",
        mentor_notes: params.mentor_notes ?? null
      }
    });

    logEvent("mentor.flag.reviewed", {
      session_id: targetFlag.session_id,
      flag_id: targetFlag.flag_id
    });
  }
}

export async function listAllUsersForMentorDashboard() {
  const db = await readDb();
  return db.users
    .map((u) => ({
      user_id: u.user_id,
      display_name: u.display_name ?? u.email?.split("@")[0] ?? "User",
      email: u.email ?? null,
      roles: u.roles ?? [],
      session_count: db.sessions.filter((s) => s.user_id === u.user_id).length,
      open_flags: db.flags.filter((f) => {
        const s = db.sessions.find((ss) => ss.session_id === f.session_id);
        return s?.user_id === u.user_id && f.status === "open";
      }).length
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export async function getStudentSessionsForMentor(userId: string) {
  const db = await readDb();
  const user = db.users.find((u) => u.user_id === userId);
  if (!user) {
    throw new Error("User not found.");
  }

  return db.sessions
    .filter((s) => s.user_id === userId)
    .sort(
      (left, right) =>
        new Date(right.started_at).getTime() - new Date(left.started_at).getTime()
    )
    .map((session) => {
      const runtime = db.agentSessionStates.find((st) => st.session_id === session.session_id);
      const flagsForSession = db.flags.filter((f) => f.session_id === session.session_id);
      return {
        session,
        current_phase: runtime?.current_phase ?? "interview_setup",
        mentor_takeover_active: false,
        has_open_flags: flagsForSession.some((f) => f.status === "open"),
        flag_count: flagsForSession.length
      };
    });
}

export async function getSessionDetailForMentor(sessionId: string) {
  const db = await readDb();
  const session = db.sessions.find((s) => s.session_id === sessionId);
  if (!session) {
    throw new Error("Session not found.");
  }

  const user = db.users.find((u) => u.user_id === session.user_id);
  const transcript = db.messages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => a.message_order - b.message_order);
  const flags = db.flags.filter((f) => f.session_id === sessionId);
  const interventions = db.mentorInterventions.filter((i) => i.session_id === sessionId);
  const runtime = db.agentSessionStates.find((s) => s.session_id === sessionId);

  return {
    session,
    student: user ?? null,
    transcript,
    flags,
    interventions,
    runtime: runtime ?? null
  };
}

export async function sendMentorLiveChatMessage(params: {
  session_id: string;
  mentor_user_id: string;
  content: string;
}, deps: Partial<MentorServiceDeps> = {}) {
  void params;
  void deps;
  throw new Error("Live mentor chat has been removed.");
}
