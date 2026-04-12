import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/65",
        className
      )}
      {...props}
    />
  );
}
