import { notFound } from "next/navigation";

import { FlagDetailClient } from "@/components/mentor/flag-detail-client";
import { requireMentorUser } from "@/lib/auth";
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
  } catch {
    notFound();
  }
}
