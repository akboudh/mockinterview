"use client";

import { Button } from "@/components/ui/button";

export function ErrorState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="premium-panel rounded-[28px] px-6 py-10 text-center">
      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Recoverable error</p>
      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-white/62">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-6">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
