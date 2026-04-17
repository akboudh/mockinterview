export function Toast({
  title,
  tone = "info",
  politeness
}: {
  title: string;
  tone?: "info" | "success" | "error";
  /** Overrides `aria-live` (defaults: errors assertive, others polite). */
  politeness?: "polite" | "assertive";
}) {
  const styles =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
      : tone === "error"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
        : "border-sky-300/30 bg-sky-300/10 text-sky-100";

  if (tone === "error") {
    return (
      <div role="alert" className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>
        {title}
      </div>
    );
  }

  const live = politeness ?? "polite";

  return (
    <div
      role="status"
      aria-live={live}
      aria-atomic="true"
      className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}
    >
      {title}
    </div>
  );
}
