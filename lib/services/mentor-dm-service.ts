import { and, eq, isNull } from "drizzle-orm";

import { mentorDirectMessagesTable } from "@/lib/db-schema";
import { readDb, runIncrementalTransaction } from "@/lib/db";
import { publishRealtimeEvent } from "@/lib/realtime/event-bus";
import type { MentorDirectMessage } from "@/lib/types";

export async function resolvePrimaryMentorUserId(): Promise<string | null> {
  const db = await readDb();
  const envEmails = (process.env.MENTOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of envEmails) {
    const u = db.users.find((x) => x.email?.toLowerCase() === email);
    if (u) {
      return u.user_id;
    }
  }
  const withRole = db.users.find((u) => u.roles?.includes("mentor"));
  return withRole?.user_id ?? null;
}

export async function sendDirectMessage(params: {
  from_user_id: string;
  to_user_id: string;
  body: string;
  session_id?: string | null;
}) {
  const trimmed = params.body.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty.");
  }

  const now = new Date().toISOString();
  const dm: MentorDirectMessage = {
    dm_id: crypto.randomUUID(),
    from_user_id: params.from_user_id,
    to_user_id: params.to_user_id,
    session_id: params.session_id ?? null,
    body: trimmed,
    created_at: now,
    read_at: null
  };

  await runIncrementalTransaction((tx) => {
    tx.insert(mentorDirectMessagesTable)
      .values({
        dm_id: dm.dm_id,
        from_user_id: dm.from_user_id,
        to_user_id: dm.to_user_id,
        session_id: dm.session_id,
        body: dm.body,
        created_at: dm.created_at,
        read_at: dm.read_at
      })
      .run();
  });

  const basePayload = {
    dm_id: dm.dm_id,
    from_user_id: dm.from_user_id,
    to_user_id: dm.to_user_id,
    session_id: dm.session_id,
    body: dm.body,
    created_at: dm.created_at
  };

  publishRealtimeEvent({
    event_id: crypto.randomUUID(),
    type: "mentor.dm.new",
    session_id: dm.session_id,
    user_id: null,
    audience: "mentor",
    created_at: now,
    payload: basePayload
  });

  publishRealtimeEvent({
    event_id: crypto.randomUUID(),
    type: "mentor.dm.new",
    session_id: dm.session_id,
    user_id: params.to_user_id,
    audience: "user",
    created_at: now,
    payload: basePayload
  });

  return dm;
}

export async function listDirectMessagesForUser(userId: string) {
  const db = await readDb();
  return db.mentorDirectMessages
    .filter((m) => m.from_user_id === userId || m.to_user_id === userId)
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

export async function listDirectMessagesBetween(userA: string, userB: string) {
  const db = await readDb();
  return db.mentorDirectMessages
    .filter(
      (m) =>
        (m.from_user_id === userA && m.to_user_id === userB) ||
        (m.from_user_id === userB && m.to_user_id === userA)
    )
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

export async function markDirectMessagesRead(params: {
  reader_user_id: string;
  other_user_id: string;
}) {
  const now = new Date().toISOString();
  await runIncrementalTransaction((tx) => {
    tx.update(mentorDirectMessagesTable)
      .set({ read_at: now })
      .where(
        and(
          eq(mentorDirectMessagesTable.to_user_id, params.reader_user_id),
          eq(mentorDirectMessagesTable.from_user_id, params.other_user_id),
          isNull(mentorDirectMessagesTable.read_at)
        )
      )
      .run();
  });
}
