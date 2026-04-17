import { notFound } from "next/navigation";
import Link from "next/link";

import { MentorSessionDetailClient } from "@/components/mentor/mentor-session-detail-client";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";
import { requireMentorUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { getSessionDetailForMentor } from "@/lib/services/mentor-service";

export const dynamic = "force-dynamic";

export default async function MentorSessionPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const mentor = await requireMentorUser();
  const { sessionId } = await params;

  try {
    const detail = await getSessionDetailForMentor(sessionId);
    return (
      <main className="page-shell py-10">
        <MentorSessionDetailClient detail={detail} mentorUserId={mentor.user_id} />
      </main>
    );
  } catch (error) {
    // Only 404 when the session truly doesn't exist; otherwise treat as transient (e.g. SQLite busy).
    const db = await readDb();
    const exists = db.sessions.some((s) => s.session_id === sessionId);
    if (!exists) {
      notFound();
    }

    return (
      <main className="page-shell py-10">
        <SectionShell
          eyebrow="Mentor dashboard"
          title="Session detail is temporarily unavailable."
          description="This can happen if the local SQLite database is briefly busy. Refresh in a moment."
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/mentor/sessions/${encodeURIComponent(sessionId)}`}>Retry</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/mentor">Back to dashboard</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-white/45">
            {error instanceof Error ? error.message : "unknown error"}
          </p>
        </SectionShell>
      </main>
    );
  }
}
