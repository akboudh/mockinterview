import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function Loading() {
  return (
    <main className="page-shell py-24">
      <div className="grid gap-6">
        <LoadingSkeleton className="h-16 rounded-[28px]" />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <LoadingSkeleton className="h-[420px] rounded-[32px]" />
          <div className="grid gap-6">
            <LoadingSkeleton className="h-[180px] rounded-[28px]" />
            <LoadingSkeleton className="h-[220px] rounded-[28px]" />
          </div>
        </div>
      </div>
    </main>
  );
}
