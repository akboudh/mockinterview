import Link from "next/link";
import { notFound } from "next/navigation";

import { MentorStudentDetailClient } from "@/components/mentor/mentor-student-detail-client";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";
import { requireMentorUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { getStudentSessionsForMentor } from "@/lib/services/mentor-service";

export const dynamic = "force-dynamic";

export default async function MentorStudentPage({
  params
}: {
  params: Promise<{ userId: string }>;
}) {
  const mentor = await requireMentorUser();
  const { userId } = await params;

  const db = await readDb();
  const user = db.users.find((u) => u.user_id === userId);
  if (!user) {
    notFound();
  }

  let sessions;
  try {
    sessions = await getStudentSessionsForMentor(userId);
  } catch (error) {
    return (
      <main className="page-shell py-10">
        <SectionShell
          eyebrow="Mentor dashboard"
          title="Student detail is temporarily unavailable."
          description="This can happen if the local SQLite database is briefly busy while messages are being saved. Refresh in a moment."
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/mentor/students/${encodeURIComponent(userId)}`}>Retry</Link>
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

  return (
    <main className="page-shell py-10">
      <MentorStudentDetailClient
        studentId={user.user_id}
        displayName={user.display_name ?? user.email?.split("@")[0] ?? "User"}
        email={user.email ?? null}
        sessions={sessions}
        mentorUserId={mentor.user_id}
      />
    </main>
  );
}
