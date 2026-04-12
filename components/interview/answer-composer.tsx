import { Button } from "@/components/ui/button";

export function AnswerComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  onHint,
  onRepeat
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  onHint?: () => void;
  onRepeat?: () => void;
}) {
  return (
    <div className="premium-panel rounded-[30px] p-5">
      <label className="grid gap-3">
        <span className="text-sm text-white/68">Your answer</span>
        <textarea
          className="field min-h-36 resize-none"
          placeholder="Respond naturally. The evaluator will score clarity, structure, relevance, and soft skills."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {onHint ? (
            <Button type="button" variant="secondary" size="sm" onClick={onHint}>
              Need a hint
            </Button>
          ) : null}
          {onRepeat ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRepeat}>
              Repeat question
            </Button>
          ) : null}
        </div>
        <Button type="button" onClick={onSubmit} disabled={disabled || !value.trim()}>
          Submit answer
        </Button>
      </div>
    </div>
  );
}
