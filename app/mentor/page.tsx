import { MentorDashboardClient } from "@/components/mentor/dashboard-client";
import { SectionShell } from "@/components/ui/section-shell";
import { requireMentorUser } from "@/lib/auth";
import { listAllUsersForMentorDashboard, listFlags } from "@/lib/services/mentor-service";

export const dynamic = "force-dynamic";

export default async function MentorPage() {
  await requireMentorUser();
  const [students, flags] = await Promise.all([listAllUsersForMentorDashboard(), listFlags()]);

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Mentor dashboard"
        title="Students first, then guardrail flags."
        description="Pick any account to see sessions, live status, takeover and chat, and async messages. The flag queue below matches the previous mentor view."
      >
        <MentorDashboardClient students={students} flags={flags} />
      </SectionShell>
    </main>
  );
}
