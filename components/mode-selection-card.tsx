"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "premium-panel h-full rounded-[26px] border p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-white/24",
        selected
          ? "border-sky-300/40 bg-[linear-gradient(180deg,rgba(142,209,255,0.11),rgba(255,255,255,0.03))]"
          : "border-white/10",
        compact ? "min-h-[160px]" : "min-h-[188px]"
      )}
    >
      <Badge className={selected ? "border-sky-200/40 bg-sky-300/12 text-sky-100" : ""}>
        {label}
      </Badge>
      <p className="mt-5 text-xl font-semibold tracking-[-0.04em] text-white">{label}</p>
      <p className="mt-3 text-sm leading-6 text-white/66">{description}</p>
    </button>
  );
}
