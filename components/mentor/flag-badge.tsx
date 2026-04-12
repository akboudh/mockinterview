import { Badge } from "@/components/ui/badge";

export function FlagBadge({ label }: { label: string }) {
  return <Badge className="border-amber-300/28 bg-amber-300/10 text-amber-100">{label}</Badge>;
}
