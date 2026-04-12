import type { ReactNode } from "react";

export function Tooltip({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex cursor-help items-center" title={label} aria-label={label}>
      {children}
    </span>
  );
}
