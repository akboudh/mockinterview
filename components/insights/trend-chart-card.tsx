import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TrendChartCard({
  title,
  items,
  className
}: {
  title: string;
  items: Array<{ label: string; value: number; subtitle?: string }>;
  className?: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card className={cn("rounded-[30px] border border-white/12 bg-white/[0.03] p-5", className)}>
      <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">{title}</h3>
      <div className="mt-6 grid gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-white/72">{item.label}</span>
              <span className="text-white/56">{item.value}</span>
            </div>
            <div
              className="h-3 rounded-full bg-white/10"
              role="group"
              aria-label={`${item.label}: ${item.value} out of ${maxValue}`}
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#89d4ff,#d98a6e)] shadow-[0_10px_24px_rgba(121,199,255,0.18)]"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            {item.subtitle ? <p className="mt-2 text-sm text-white/52">{item.subtitle}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
