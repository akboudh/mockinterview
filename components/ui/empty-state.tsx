import Link from "next/link";

import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  href,
  actionLabel
}: {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="premium-panel rounded-[28px] px-6 py-10 text-center">
      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Empty state</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-white/62">{description}</p>
      {href && actionLabel ? (
        <div className="mt-6">
          <Button asChild>
            <Link href={href}>{actionLabel}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
