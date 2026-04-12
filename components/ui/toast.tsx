export function Toast({
  title,
  tone = "info"
}: {
  title: string;
  tone?: "info" | "success" | "error";
}) {
  const styles =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : tone === "error"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
        : "border-sky-300/30 bg-sky-300/10 text-sky-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      {title}
    </div>
  );
}
