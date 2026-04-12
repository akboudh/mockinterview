import { notFound, redirect } from "next/navigation";

import { LiveInterviewClient } from "@/components/interview/live-interview-client";
import { requireCurrentUser } from "@/lib/auth";
import { getSessionSummary } from "@/lib/services/session-service";

export default async function InterviewPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  try {
    const user = await requireCurrentUser();
    const { sessionId } = await params;
    const summary = await getSessionSummary(sessionId, user.user_id);
    if (
      summary.session.status === "completed" ||
      summary.agent_runtime.current_phase === "session_feedback"
    ) {
      redirect(`/results/${sessionId}`);
    }
    return <LiveInterviewClient initialSummary={summary} />;
  } catch {
    notFound();
  }
}
