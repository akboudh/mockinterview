import { notFound } from "next/navigation";
import Link from "next/link";

import { FlagDetailClient } from "@/components/mentor/flag-detail-client";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";
import { requireMentorUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { getFlagDetail } from "@/lib/services/mentor-service";

export default async function FlagDetailPage({
  params
}: {
  params: Promise<{ flagId: string }>;
}) {
  await requireMentorUser();
  const { flagId } = await params;

  try {
    const detail = await getFlagDetail(flagId);

    return (
      <main className="page-shell py-10">
        <FlagDetailClient {...detail} />
      </main>
    );
  } catch (error) {
    // Only 404 when the flag truly doesn't exist; otherwise treat as transient (e.g. SQLite busy).
    const db = await readDb();
    const exists = db.flags.some((f) => f.flag_id === flagId);
    if (!exists) {
      notFound();
    }

    return (
      <main className="page-shell py-10">
        <SectionShell
          eyebrow="Mentor dashboard"
          title="Flag detail is temporarily unavailable."
          description="This can happen if the local SQLite database is briefly busy. Refresh in a moment."
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/mentor/flags/${encodeURIComponent(flagId)}`}>Retry</Link>
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
}
