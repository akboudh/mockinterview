import { recallContext } from "@/lib/services/memory-service";
import { InterviewSetupForm } from "@/components/forms/interview-setup-form";
import { SectionShell } from "@/components/ui/section-shell";
import { requireCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const user = await requireCurrentUser();
  const priorContext = await recallContext({
    user_id: user.user_id,
    query_type: "long_term",
    query_text: "recent weaknesses"
  });

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Interview setup"
        title="Shape the next session before you hit launch."
        description="Set the role, choose the interview mode, and tune the amount of timing, resume context, and coaching support you want. The preview updates live."
      >
        <InterviewSetupForm
          personalizationAvailable={priorContext.context_items.length > 0}
          initialResumeText={user.resume_text ?? null}
          initialResumeFileName={user.resume_file_name ?? null}
        />
      </SectionShell>
    </main>
  );
}
