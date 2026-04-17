"use client";

import { BarChart3, BriefcaseBusiness, Check, Code2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function modeVisual(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("technical")) {
    return {
      Icon: Code2,
      accent: "from-cyan-400/16 to-sky-500/10",
      meta: "Tradeoffs, systems, debugging"
    };
  }

  if (normalized.includes("case")) {
    return {
      Icon: BarChart3,
      accent: "from-orange-400/16 to-amber-500/10",
      meta: "Assumptions, prioritization, synthesis"
    };
  }

  return {
    Icon: BriefcaseBusiness,
    accent: "from-emerald-400/16 to-teal-500/10",
    meta: "Stories, judgment, communication"
  };
}

export function ModeSelectionCard({
  label,
  description,
  selected = false,
  onSelect,
  compact = false
}: {
  label: string;
  description: string;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}) {
  const { Icon, accent, meta } = modeVisual(label);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "premium-panel group relative h-full overflow-hidden rounded-[26px] border p-5 text-left transition duration-300 ease-out hover:-translate-y-1.5 hover:border-white/24",
        selected
          ? "border-sky-300/40 bg-[linear-gradient(180deg,rgba(142,209,255,0.11),rgba(255,255,255,0.03))] shadow-[0_28px_56px_rgba(7,18,34,0.28)]"
          : "border-white/10",
        compact ? "min-h-[188px]" : "min-h-[208px]"
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-80 transition duration-200",
          accent,
          selected ? "opacity-100" : "opacity-65 group-hover:opacity-90"
        )}
      />
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-white shadow-[0_12px_28px_rgba(8,15,28,0.2)] transition duration-300 group-hover:scale-[1.03]",
                selected
                  ? "border-sky-200/30 bg-sky-300/12"
                  : "border-white/12 bg-white/8"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xl font-semibold tracking-[-0.04em] text-white">{label}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/48">{meta}</p>
            </div>
          </div>
          {selected ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200/35 bg-sky-300/12 text-sky-100">
              <Check className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <p className="relative z-10 mt-5 text-sm leading-6 text-white/66">{description}</p>
        <div className="mt-auto pt-5">
          <Badge className={selected ? "border-sky-200/40 bg-sky-300/12 text-sky-100" : ""}>
            {selected ? "Selected" : "Choose mode"}
          </Badge>
        </div>
      </div>
    </button>
  );
}
