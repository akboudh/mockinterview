import { Card } from "@/components/ui/card";

export function TrendChartCard({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; value: number; subtitle?: string }>;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card className="rounded-[28px] p-5">
      <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
      <div className="mt-6 grid gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-white/72">{item.label}</span>
              <span className="text-white/56">{item.value}</span>
            </div>
            <div className="h-3 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#73bde8,#d98a6e)]"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
            {item.subtitle ? <p className="mt-2 text-sm text-white/52">{item.subtitle}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
