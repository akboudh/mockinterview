import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("premium-panel rounded-[28px] p-6 text-white/88", className)}
      {...props}
    />
  );
}

export function LightCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("light-panel rounded-[28px] p-6 text-slate-900", className)}
      {...props}
    />
  );
}
