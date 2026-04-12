import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import type { Message } from "@/lib/types";

const speakerStyles = {
  interviewer: "border-sky-200/18 bg-sky-300/10 text-white",
  student: "border-white/14 bg-white/8 text-white",
  mentor: "border-amber-200/30 bg-amber-200/12 text-amber-50",
  system: "border-white/10 bg-white/5 text-white/70"
};

export function ConversationBubble({ message }: { message: Message }) {
  return (
    <article
      className={cn(
        "rounded-[28px] border px-5 py-4 shadow-glass",
        speakerStyles[message.speaker_type]
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Badge>{message.speaker_type}</Badge>
        <span className="text-xs uppercase tracking-[0.18em] text-white/38">
          {formatDateTime(message.created_at)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>
    </article>
  );
}
