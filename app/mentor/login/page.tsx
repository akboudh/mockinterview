import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";
import { getCurrentUser, userHasRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MentorLoginPage() {
  const user = await getCurrentUser();

  if (userHasRole(user, ["mentor", "admin"])) {
    redirect("/mentor");
  }

  if (user) {
    redirect("/setup");
  }

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Mentor login"
        title="Sign in with mentor access before opening the review dashboard."
        description="Mentor accounts use the same local auth system, but they must be created with an approved mentor email or the shared mentor signup code."
      >
        <AuthPanel context="mentor" />
        <div className="mt-6 flex justify-end">
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Student sign in</Link>
          </Button>
        </div>
      </SectionShell>
    </main>
  );
}
