import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SectionShell({
  eyebrow,
  title,
  description,
  children,
  className,
  tone = "dark",
  titleAs = "h2"
}: {
  eyebrow?: string;
  /** Omit when the page provides a single main heading elsewhere (e.g. auth card). */
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "dark" | "light";
  /** Use `h1` on standalone pages (e.g. login) so nested cards use `h2`. */
  titleAs?: "h1" | "h2";
}) {
  const TitleTag = titleAs === "h1" ? "h1" : "h2";
  const hasHeader = Boolean(eyebrow || title || description);

  return (
    <section
      className={cn(
        tone === "dark" ? "premium-panel text-white" : "light-panel text-slate-900",
        "relative rounded-[36px] px-6 py-8 md:px-8 md:py-10",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-90",
          tone === "dark"
            ? "bg-[radial-gradient(circle_at_top_left,rgba(121,199,255,0.08),transparent_28%)]"
            : "bg-[radial-gradient(circle_at_top_left,rgba(8,17,31,0.06),transparent_26%)]"
        )}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
      {hasHeader ? (
        <div className="relative z-10 mb-8 max-w-3xl space-y-4">
          {eyebrow ? (
            <Badge className={tone === "light" ? "border-slate-200 bg-slate-950/5 text-slate-600" : ""}>
              {eyebrow}
            </Badge>
          ) : null}
          {title ? (
            <TitleTag className="font-display text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
              {title}
            </TitleTag>
          ) : null}
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
      ) : null}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
