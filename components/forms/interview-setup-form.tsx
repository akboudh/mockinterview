"use client";

import { useState, startTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { INTERVIEW_MODES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { VoicePreviewPicker } from "@/components/interview/voice-preview-picker";
import { extractResumeHighlights } from "@/lib/personalization";
import type { InterviewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

type JsonPayload = Record<string, unknown>;
const QUESTION_TIME_LIMIT_OPTIONS = [
  { label: "No limit", value: "none" },
  { label: "30 seconds", value: "30" },
  { label: "1 minute", value: "60" },
  { label: "2 minutes", value: "120" },
  { label: "5 minutes", value: "300" }
] as const;
const QUESTION_LIMIT_OPTIONS = [
  { label: "3 questions", value: "3" },
  { label: "5 questions", value: "5" },
  { label: "7 questions", value: "7" },
  { label: "10 questions", value: "10" }
] as const;
const MODE_PRESETS: Record<
  InterviewMode,
  { title: string; copy: string; cues: string[] }
> = {
  behavioral: {
    title: "Narrative + judgment",
    copy: "Best when you want crisp STAR structure, ownership, and communication signal.",
    cues: ["Ownership", "Reflection", "Impact"]
  },
  technical: {
    title: "Tradeoffs + debugging",
    copy: "Useful for reasoning through system choices, code quality, and problem-solving under pressure.",
    cues: ["Architecture", "Debugging", "Tradeoffs"]
  },
  case: {
    title: "Structure + synthesis",
    copy: "Ideal for assumption framing, prioritization, and walking through ambiguous business problems.",
    cues: ["Assumptions", "Priorities", "Synthesis"]
  }
};

async function readJsonPayload(response: Response): Promise<JsonPayload> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as JsonPayload;
  }

  const text = await response.text();
  const serverMessage = text.match(/"message":"([^"]+)"/)?.[1]?.replaceAll('\\"', '"');

  throw new Error(
    serverMessage || `Unexpected ${response.status} response from the server.`
  );
}

function getErrorMessage(payload: JsonPayload, fallback: string) {
  return typeof payload.error === "string" ? payload.error : fallback;
}

function getStringValue(payload: JsonPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function InterviewSetupForm({
  personalizationAvailable,
  initialResumeText,
  initialResumeFileName
}: {
  personalizationAvailable: boolean;
  initialResumeText?: string | null;
  initialResumeFileName?: string | null;
}) {
  const router = useRouter();
  const [targetRole, setTargetRole] = useState("");
  const [mode, setMode] = useState<InterviewMode>("behavioral");
  const [focusArea, setFocusArea] = useState("");
  const [confidence, setConfidence] = useState("3");
  const [questionLimit, setQuestionLimit] = useState<string>("5");
  const [questionTimeLimit, setQuestionTimeLimit] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [resumeText, setResumeText] = useState(initialResumeText ?? "");
  const [resumeFileName, setResumeFileName] = useState<string | null>(initialResumeFileName ?? null);
  const [resumeHighlights, setResumeHighlights] = useState<string[]>(
    initialResumeText ? extractResumeHighlights(initialResumeText) : []
  );
  const [parsingResume, setParsingResume] = useState(false);
  const [removingResume, setRemovingResume] = useState(false);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [selfCritiqueEnabled, setSelfCritiqueEnabled] = useState(true);
  const [resumeDetailsOpen, setResumeDetailsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMode = INTERVIEW_MODES.find((item) => item.value === mode) ?? INTERVIEW_MODES[0];
  const selectedPreset = MODE_PRESETS[mode];
  const estimatedMinutes =
    questionTimeLimit === "none"
      ? null
      : Math.max(1, Math.round((Number(questionLimit) * Number(questionTimeLimit)) / 60));
  const previewRows = [
    { label: "Mode", value: selectedMode.label },
    { label: "Role", value: targetRole.trim() || "Add a role to anchor the session" },
    {
      label: "Cadence",
      value: `${QUESTION_LIMIT_OPTIONS.find((o) => o.value === questionLimit)?.label ?? "—"} · ${
        QUESTION_TIME_LIMIT_OPTIONS.find((o) => o.value === questionTimeLimit)?.label ?? "—"
      }`
    },
    {
      label: "Coaching",
      value: selfCritiqueEnabled ? "Rubric + self-critique" : "Rubric feedback only"
    }
  ];
  const readinessChecks = [
    {
      label: "Personalization",
      value: personalizationEnabled
        ? personalizationAvailable
          ? "Using prior history"
          : "Enabled for future history"
        : "Off for this run",
      active: personalizationEnabled
    },
    {
      label: "Resume context",
      value: resumeText ? "Uploaded" : "Not uploaded",
      active: Boolean(resumeText)
    },
    {
      label: "Session length",
      value: estimatedMinutes ? `Up to about ${estimatedMinutes} min` : "Flexible pacing",
      active: true
    }
  ];

  async function handleResumeUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setParsingResume(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/resume/parse", {
        method: "POST",
        body: formData
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to parse the uploaded resume."));
      }

      const saveResponse = await fetch("/profile/resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resume_text: getStringValue(payload, "resume_text") ?? "",
          file_name: getStringValue(payload, "file_name") ?? file.name
        })
      });
      const savePayload = await readJsonPayload(saveResponse);

      if (!saveResponse.ok) {
        throw new Error(getErrorMessage(savePayload, "Unable to save the uploaded resume."));
      }

      setResumeText(
        getStringValue(savePayload, "resume_text") ?? getStringValue(payload, "resume_text") ?? ""
      );
      setResumeFileName(
        getStringValue(savePayload, "resume_file_name") ?? getStringValue(payload, "file_name") ?? file.name
      );
      setResumeDetailsOpen(false);
      setResumeHighlights(
        Array.isArray(savePayload.resume_highlights)
          ? savePayload.resume_highlights.filter((item: unknown): item is string => typeof item === "string")
          : []
      );
    } catch (uploadError) {
      setResumeText("");
      setResumeFileName(null);
      setResumeHighlights([]);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to parse the uploaded resume."
      );
    } finally {
      setParsingResume(false);
      event.target.value = "";
    }
  }

  async function handleResumeRemoval() {
    setRemovingResume(true);
    setError(null);

    try {
      const response = await fetch("/profile/resume", {
        method: "DELETE"
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to remove the saved resume."));
      }

      setResumeText("");
      setResumeFileName(null);
      setResumeHighlights([]);
      setResumeDetailsOpen(false);
    } catch (removalError) {
      setError(
        removalError instanceof Error
          ? removalError.message
          : "Unable to remove the saved resume."
      );
    } finally {
      setRemovingResume(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!targetRole.trim()) {
      setError("Target role is required before the session can start.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/start_session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target_role: targetRole,
          mode,
          focus_area: focusArea || null,
          confidence_self_rating: Number(confidence) || null,
          question_limit: Number(questionLimit),
          question_time_limit_seconds:
            questionTimeLimit === "none" ? null : Number(questionTimeLimit),
          personalization_enabled: personalizationEnabled,
          self_critique_enabled: selfCritiqueEnabled,
          notes: notes || null,
          resume_text: resumeText || null
        })
      });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to start the interview."));
      }

      startTransition(() => {
        router.push(`/interview/${payload.session_id}`);
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to start the interview."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
      <Card className="space-y-8 rounded-[36px] p-6 md:p-7">
        <div className="space-y-3">
          <p className="eyebrow-copy text-white/45">Session brief</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white md:text-[2.2rem]">
            Build a practice run that feels intentional.
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-white/62 md:text-base">
            Choose the role, pick the style of questioning, and decide how much structure and
            memory you want the interviewer to use.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Target role</span>
            <input
              className="field"
              placeholder="Software Engineer Intern"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Focus area (optional)</span>
            <input
              className="field"
              placeholder="Leadership, debugging, prioritization…"
              value={focusArea}
              onChange={(event) => setFocusArea(event.target.value)}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow-copy text-white/45">Interview mode</p>
              <p className="mt-2 text-sm text-white/56">
                Pick the question style for this run.
              </p>
            </div>
            <p className="text-sm text-white/45">{selectedPreset.title}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {INTERVIEW_MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                aria-pressed={mode === item.value}
                className={cn(
                  "rounded-[22px] border px-4 py-4 text-left transition duration-200",
                  mode === item.value
                    ? "border-sky-300/35 bg-sky-300/[0.09] text-white"
                    : "border-white/10 bg-white/[0.03] text-white/78 hover:border-white/20 hover:bg-white/[0.05]"
                )}
              >
                <p className="text-base font-semibold tracking-[-0.03em]">{item.label}</p>
                <p className="mt-1 text-sm leading-6 text-white/56">{item.description}</p>
              </button>
            ))}
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Selected mode</p>
            <p className="mt-2 text-sm font-medium text-white">{selectedPreset.title}</p>
            <p className="mt-1 text-sm leading-6 text-white/58">{selectedPreset.copy}</p>
          </div>
          <VoicePreviewPicker className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4" />
        </div>

        <div className="section-divider" />

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Confidence</span>
            <select
              className="field"
              value={confidence}
              onChange={(event) => setConfidence(event.target.value)}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value} / 5
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Question limit</span>
            <select
              className="field"
              value={questionLimit}
              onChange={(event) => setQuestionLimit(event.target.value)}
            >
              {QUESTION_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Time per question</span>
            <select
              className="field"
              value={questionTimeLimit}
              onChange={(event) => setQuestionTimeLimit(event.target.value)}
            >
              {QUESTION_TIME_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm text-white/74">Notes for the interviewer (optional)</span>
          <textarea
            className="field min-h-28 resize-none"
            placeholder="Constraints, goals, or context for this round."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow-copy text-white/45">Resume context</p>
                <p className="mt-2 text-sm text-white/58">
                  Upload a recent resume to seed prompts with concrete projects and experience.
                </p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.markdown,.doc,.docx,.rtf,.rtfd,.html,.htm,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf"
                  onChange={handleResumeUpload}
                  disabled={parsingResume || removingResume || submitting}
                />
                <span className="inline-flex items-center justify-center rounded-full border border-white/14 bg-white/6 px-4 py-2.5 text-sm font-medium text-white transition duration-200 hover:border-white/24 hover:bg-white/10">
                  {parsingResume ? "Reading…" : resumeText ? "Replace" : "Upload"}
                </span>
              </label>
            </div>

            {resumeText ? (
              <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm text-white/68">
                <p className="font-medium text-white">Resume uploaded</p>
                <p className="mt-1 text-white/56">{resumeFileName ?? "Saved to your profile."}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    className="text-sm text-white/58 underline-offset-4 hover:text-white hover:underline"
                    onClick={() => setResumeDetailsOpen(true)}
                  >
                    Show extracted profile
                  </button>
                  <button
                    type="button"
                    className="text-sm text-white/58 underline-offset-4 hover:text-white hover:underline"
                    onClick={handleResumeRemoval}
                    disabled={removingResume}
                  >
                    {removingResume ? "Removing…" : "Remove from profile"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/48">
                Text-based PDFs parse most reliably; image-only scans may need cleanup outside the app.
              </p>
            )}
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5">
            <div>
              <p className="eyebrow-copy text-white/45">Coaching options</p>
              <p className="mt-2 text-sm text-white/58">
                Control how much memory and evaluator transparency show up in this run.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              <label
                className={cn(
                  "flex items-start gap-3 rounded-[24px] border p-4 transition duration-200",
                  personalizationEnabled
                    ? "border-sky-200/22 bg-sky-300/[0.08]"
                    : "border-white/10 bg-black/10"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-sky-300"
                  checked={personalizationEnabled}
                  onChange={(event) => setPersonalizationEnabled(event.target.checked)}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    Prior personalization
                    <Tooltip label="Uses long-term memory and weak-skill signals when available.">
                      <span className="text-white/45">?</span>
                    </Tooltip>
                  </span>
                  <span className="block text-sm leading-6 text-white/58">
                    {personalizationAvailable
                      ? "History is available for this account."
                      : "No prior sessions yet; this becomes more useful after a few runs."}
                  </span>
                </span>
              </label>

              <label
                className={cn(
                  "flex items-start gap-3 rounded-[24px] border p-4 transition duration-200",
                  selfCritiqueEnabled
                    ? "border-white/14 bg-white/[0.06]"
                    : "border-white/10 bg-black/10"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-sky-300"
                  checked={selfCritiqueEnabled}
                  onChange={(event) => setSelfCritiqueEnabled(event.target.checked)}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    Evaluator self-critique
                    <Tooltip label="Short reflection on rubric coverage in results.">
                      <span className="text-white/45">?</span>
                    </Tooltip>
                  </span>
                  <span className="block text-sm leading-6 text-white/58">
                    Adds a short explanation of how the rubric judged the session.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {error ? <Toast title={error} tone="error" /> : null}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
          <p className="text-sm text-white/50">
            Adaptive follow-ups, rubric feedback, and transcript storage stay on by default.
          </p>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Starting…" : "Launch interview"}
          </Button>
        </div>
      </Card>

      <Card className="sticky top-24 h-fit rounded-[36px] border border-sky-200/12 bg-[linear-gradient(160deg,rgba(121,199,255,0.09),rgba(255,132,97,0.04))] p-6 md:p-7">
        <p className="eyebrow-copy text-white/45">Live preview</p>
        <h3 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white">
          {targetRole.trim() || "Your target role"}
        </h3>
        <p className="mt-3 text-sm leading-7 text-white/62">{selectedPreset.copy}</p>

        <div className="mt-6 grid gap-3">
          {previewRows.map((row) => (
            <div
              key={row.label}
              className="rounded-[22px] border border-white/10 bg-black/15 px-4 py-3"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/42">{row.label}</p>
              <p className="mt-1 text-sm leading-6 text-white/82">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Readiness</p>
          <ul className="mt-4 grid gap-3">
            {readinessChecks.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 rounded-full",
                    item.active ? "bg-sky-300 shadow-[0_0_0_6px_rgba(142,209,255,0.12)]" : "bg-white/20"
                  )}
                />
                <span>
                  <span className="block text-sm font-medium text-white">{item.label}</span>
                  <span className="block text-sm leading-6 text-white/58">{item.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-[24px] border border-white/10 bg-black/15 p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/42">Session pace</p>
          <p className="mt-2 text-sm leading-6 text-white/72">
            {estimatedMinutes
              ? `Expect a focused run of about ${estimatedMinutes} minutes if every question uses the full timer.`
              : "No hard timer is set, so the session can stay conversational and flexible."}
          </p>
        </div>
      </Card>

      <Modal
        open={resumeDetailsOpen}
        title="Extracted profile"
        description={resumeFileName ?? "Saved resume context"}
        onClose={() => setResumeDetailsOpen(false)}
      >
        <div className="space-y-4">
          {resumeHighlights.length ? (
            <div className="flex flex-wrap gap-2">
              {resumeHighlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/62"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div className="max-h-[50vh] overflow-y-auto rounded-[20px] border border-white/10 bg-[rgba(0,0,0,0.34)] p-4">
            <p className="whitespace-pre-wrap text-sm leading-7 text-white/68">
              {resumeText || "No extracted profile text is available."}
            </p>
          </div>
        </div>
      </Modal>
    </form>
  );
}
