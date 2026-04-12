import { cn } from "@/lib/utils";

export function AlertBanner({
  title,
  description,
  tone = "info"
}: {
  title: string;
  description: string;
  tone?: "info" | "warning" | "safe";
}) {
  const styles =
    tone === "warning"
      ? "border-amber-300/28 bg-amber-300/10 text-amber-50"
      : tone === "safe"
        ? "border-emerald-300/28 bg-emerald-300/10 text-emerald-50"
        : "border-sky-300/28 bg-sky-300/10 text-sky-50";

  return (
    <div className={cn("rounded-[24px] border px-4 py-4", styles)}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-80">{description}</p>
    </div>
  );
}
