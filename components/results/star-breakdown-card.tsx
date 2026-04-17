import { Card } from "@/components/ui/card";

export function StarBreakdownCard({
  title,
  content
}: {
  title: string;
  content: string;
}) {
  return (
    <Card className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-white/42">{title}</p>
      <p className="mt-4 text-sm leading-7 text-white/66">{content}</p>
    </Card>
  );
}
