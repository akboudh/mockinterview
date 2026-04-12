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
        title="Configure the role, mode, and coaching depth before the session starts."
        description="Required fields are enforced. The preview panel shows what the session will include, including whether personalization history is available."
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
