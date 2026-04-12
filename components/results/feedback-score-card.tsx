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
    <Card className="rounded-[28px] p-5">
      <p className="text-sm text-white/52">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-4xl font-semibold tracking-[-0.05em] text-white">{score}</p>
        <p className="text-sm text-white/52">/ 5</p>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/64">{description}</p>
    </Card>
  );
}
