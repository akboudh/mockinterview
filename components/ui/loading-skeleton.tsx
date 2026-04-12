import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulseSoft bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.18),rgba(255,255,255,0.08))]",
        className
      )}
      {...props}
    />
  );
}
