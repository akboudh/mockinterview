import { Card } from "@/components/ui/card";

export function StarBreakdownCard({
  title,
  content
}: {
  title: string;
  content: string;
}) {
  return (
    <Card className="rounded-[28px] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-white/48">{title}</p>
      <p className="mt-4 text-sm leading-7 text-white/66">{content}</p>
    </Card>
  );
}
