import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SectionShell({
  eyebrow,
  title,
  description,
  children,
  className,
  tone = "dark"
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <section
      className={cn(
        tone === "dark" ? "premium-panel text-white" : "light-panel text-slate-900",
        "rounded-[36px] px-6 py-8 md:px-8 md:py-10",
        className
      )}
    >
      <div className="mb-8 max-w-3xl space-y-4">
        {eyebrow ? (
          <Badge className={tone === "light" ? "border-slate-200 bg-slate-950/5 text-slate-600" : ""}>
            {eyebrow}
          </Badge>
        ) : null}
        <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">{title}</h2>
        {description ? (
          <p
            className={cn(
              "max-w-2xl text-base leading-7",
              tone === "dark" ? "text-white/68" : "text-slate-600"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
