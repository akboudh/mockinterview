import { readDb, updateDb } from "@/lib/db";
import { loadGuardrailPolicy } from "@/lib/guardrails/policy-loader";
import { publishRealtimeEvent } from "@/lib/realtime/event-bus";
import { saveEvent } from "@/lib/services/memory-service";
import type { FlagCategory, FlagEvent, GuardrailRuntimePolicy } from "@/lib/types";

interface GuardrailMatch {
  policy_id: string;
  flag_reason: string;
  flag_category: FlagCategory;
  severity: "low" | "medium" | "high";
  labels: string[];
}

interface GuardrailServiceDeps {
  loadPolicy: () => GuardrailRuntimePolicy;
  readDb: typeof readDb;
  updateDb: typeof updateDb;
  saveEvent: typeof saveEvent;
  publishRealtimeEvent: typeof publishRealtimeEvent;
  now: () => string;
  randomUUID: () => string;
}

function withGuardrailDeps(overrides: Partial<GuardrailServiceDeps> = {}): GuardrailServiceDeps {
  return {
    loadPolicy: loadGuardrailPolicy,
    readDb,
    updateDb,
    saveEvent,
    publishRealtimeEvent,
    now: () => new Date().toISOString(),
    randomUUID: () => crypto.randomUUID(),
    ...overrides
  };
}

export function inspectForGuardrails(text: string, deps: Partial<GuardrailServiceDeps> = {}) {
  const resolvedDeps = withGuardrailDeps(deps);
  const policy = resolvedDeps.loadPolicy();
  const findings: GuardrailMatch[] = [];

  for (const rule of policy.policies) {
    if (rule.matchers.some((pattern) => pattern.test(text))) {
      findings.push({
        policy_id: rule.id,
        flag_reason: rule.description,
        flag_category: rule.category,
        severity: rule.severity,
        labels: rule.labels
      });
    }
  }

  return findings;
}

export async function recordGuardrailFlags(params: {
  session_id: string;
  user_id?: string | null;
  message_id?: string | null;
  findings: GuardrailMatch[];
}, deps: Partial<GuardrailServiceDeps> = {}) {
  const resolvedDeps = withGuardrailDeps(deps);
  if (!params.findings.length) {
    return [];
  }

  const createdAt = resolvedDeps.now();
  const createdFlags: FlagEvent[] = params.findings.map((finding) => ({
    flag_id: resolvedDeps.randomUUID(),
    session_id: params.session_id,
    message_id: params.message_id ?? null,
    flag_reason: finding.flag_reason,
    flag_category: finding.flag_category,
    status: "open",
    mentor_notes: null,
    created_at: createdAt,
    resolved_at: null
  }));

  await resolvedDeps.updateDb((db) => ({
    ...db,
    sessions: db.sessions.map((session) =>
      session.session_id === params.session_id
        ? { ...session, status: "flagged" }
        : session
    ),
    agentSessionStates: db.agentSessionStates.map((state) =>
      state.session_id === params.session_id
        ? {
            ...state,
            flagged: true,
            guardrail_findings: [
              ...(state.guardrail_findings ?? []),
              ...params.findings.map((finding) => ({
                flag_reason: finding.flag_reason,
                flag_category: finding.flag_category
              }))
            ],
            updated_at: createdAt
          }
        : state
    ),
    flags: [...db.flags, ...createdFlags]
  }));

  const db = await resolvedDeps.readDb();
  const sessionUserId =
    params.user_id ??
    db.sessions.find((session) => session.session_id === params.session_id)?.user_id ??
    "demo-student";

  for (let index = 0; index < createdFlags.length; index += 1) {
    const flag = createdFlags[index];
    const finding = params.findings[index];

    await resolvedDeps.saveEvent({
      session_id: params.session_id,
      user_id: sessionUserId,
      memory_tier: "episodic",
      event_type: "guardrail_flag",
      content: {
        flag_id: flag.flag_id,
        flag_reason: flag.flag_reason,
        flag_category: flag.flag_category,
        message_id: flag.message_id ?? null,
        policy_id: finding?.policy_id ?? null,
        severity: finding?.severity ?? null,
        labels: finding?.labels ?? []
      }
    });

    const basePayload = {
      flag_id: flag.flag_id,
      flag_reason: flag.flag_reason,
      flag_category: flag.flag_category,
      status: flag.status,
      session_id: flag.session_id,
      message_id: flag.message_id ?? null,
      severity: finding?.severity ?? null,
      labels: finding?.labels ?? []
    };

    resolvedDeps.publishRealtimeEvent({
      event_id: resolvedDeps.randomUUID(),
      type: "session.flag.created",
      session_id: params.session_id,
      user_id: sessionUserId,
      audience: "session",
      created_at: resolvedDeps.now(),
      payload: basePayload
    });
    resolvedDeps.publishRealtimeEvent({
      event_id: resolvedDeps.randomUUID(),
      type: "session.flag.created",
      session_id: params.session_id,
      user_id: sessionUserId,
      audience: "mentor",
      created_at: resolvedDeps.now(),
      payload: basePayload
    });
  }

  return createdFlags;
}
