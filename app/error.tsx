"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-shell py-20">
      <ErrorState
        title="Something interrupted the session."
        description="The application hit a recoverable error. You can retry safely without losing the demo data already stored."
        actionLabel="Try again"
        onAction={reset}
      />
    </main>
  );
}
