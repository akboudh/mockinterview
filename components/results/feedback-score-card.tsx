import { Card } from "@/components/ui/card";

export function FeedbackScoreCard({
  label,
  score,
  description
}: {
  label: string;
  score: number;
  description: string;
}) {
  return (
    <Card className="rounded-[30px] border border-white/12 bg-[linear-gradient(160deg,rgba(121,199,255,0.08),rgba(255,255,255,0.02))] p-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-display text-5xl font-semibold tracking-[-0.06em] text-white">{score}</p>
        <p className="pb-1 text-sm text-white/48">/ 5</p>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/60">{description}</p>
    </Card>
  );
}
