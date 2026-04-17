import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth/auth-panel";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";
import { getCurrentUser, userHasRole } from "@/lib/auth";
import { getStudentLoginHref } from "@/lib/cross-app-urls";

export const dynamic = "force-dynamic";

export default async function MentorLoginPage() {
  const user = await getCurrentUser();

  if (userHasRole(user, ["mentor", "admin"])) {
    redirect("/mentor");
  }

  if (user) {
    // On the mentor surface, a signed-in student can't use the mentor login flow.
    // Avoid cross-origin redirects here (can throw in Server Components); show a clear escape hatch instead.
    return (
      <main className="page-shell py-10">
        <SectionShell
          eyebrow="Mentor login"
          title="You're signed in as a student on the mentor app."
          description="Open the student app to continue, or log out here to sign in as a mentor."
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={getStudentLoginHref()}>Open student app</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/auth/logout">Log out</Link>
            </Button>
          </div>
        </SectionShell>
      </main>
    );
  }

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Mentor login"
        description="Approved mentor email or access code required. Same auth as students; role controls dashboard access."
      >
        <AuthPanel context="mentor" />
        <div className="mt-6 flex justify-end">
          <Button asChild variant="secondary" size="sm">
            <Link href={getStudentLoginHref()}>Student sign in</Link>
          </Button>
        </div>
      </SectionShell>
    </main>
  );
}
