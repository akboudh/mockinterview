import { MentorDashboardClient } from "@/components/mentor/dashboard-client";
import { SectionShell } from "@/components/ui/section-shell";
import { requireMentorUser } from "@/lib/auth";
import { listFlags } from "@/lib/services/mentor-service";

export const dynamic = "force-dynamic";

export default async function MentorPage() {
  await requireMentorUser();
  const flags = await listFlags();

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Mentor dashboard"
        title="Review flagged sessions, filter by status, and intervene when needed."
        description="The dashboard consolidates guardrail events into a mentor-friendly queue. Each row links into a detailed transcript and evaluation view with supplemental feedback and takeover controls."
      >
        <MentorDashboardClient flags={flags} />
      </SectionShell>
    </main>
  );
}
