import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/ui/section-shell";

export default function NotFound() {
  return (
    <main className="page-shell py-20">
      <SectionShell
        eyebrow="404"
        title="This route drifted out of the interview flow."
        description="Use the primary flows below to get back into setup, results, or mentor review."
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/setup">Start Mock Interview</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/mentor">Open Mentor Dashboard</Link>
          </Button>
        </div>
      </SectionShell>
    </main>
  );
}
