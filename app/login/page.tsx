import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";
import { getCurrentUser } from "@/lib/auth";
import { getMentorLoginHref } from "@/lib/cross-app-urls";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/setup");
  }

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Login"
        description="Use your account so interview history, resume context, and insights stay in one place."
      >
        <AuthPanel context="student" />
        <div className="mt-6 flex justify-end">
          <Button asChild variant="secondary" size="sm">
            <Link href={getMentorLoginHref()}>Mentor sign in</Link>
          </Button>
        </div>
      </SectionShell>
    </main>
  );
}
