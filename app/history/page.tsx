import { HistoryClient } from "@/components/history/history-client";
import { SectionShell } from "@/components/ui/section-shell";
import { requireCurrentUser } from "@/lib/auth";
import { listSessions } from "@/lib/services/session-service";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireCurrentUser();
  const sessions = await listSessions(user.user_id);

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Session history"
        title="Browse prior interview sessions by role, mode, and date."
        description="The history view reads from episodic memory and saved evaluation artifacts. Empty states stay calm, and each session can open directly into its detailed results page."
      >
        <HistoryClient sessions={sessions} />
      </SectionShell>
    </main>
  );
}
