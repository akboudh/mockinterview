import { StudentMentorInbox } from "@/components/student/student-mentor-inbox";
import { SectionShell } from "@/components/ui/section-shell";
import { requireCurrentUser } from "@/lib/auth";
import { listDirectMessagesForUser } from "@/lib/services/mentor-dm-service";

export const dynamic = "force-dynamic";

export default async function StudentMentorPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireCurrentUser();
  const { session_id: sessionId } = await searchParams;
  const messages = await listDirectMessagesForUser(user.user_id);

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Mentor"
        title="Message your mentor"
        description="Send questions about practice sessions or feedback. Replies appear here when your mentor responds."
      >
        <StudentMentorInbox
          initialMessages={messages}
          currentUserId={user.user_id}
          contextSessionId={sessionId?.trim() || null}
        />
      </SectionShell>
    </main>
  );
}
