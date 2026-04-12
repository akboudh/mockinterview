"use client";

import { useState, startTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { INTERVIEW_MODES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModeSelectionCard } from "@/components/mode-selection-card";
import { Toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { extractResumeHighlights } from "@/lib/personalization";
import type { InterviewMode } from "@/lib/types";

type JsonPayload = Record<string, unknown>;

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="space-y-6 rounded-[34px] p-7">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">
            Session configuration
          </p>
          <h3 className="text-3xl font-semibold tracking-[-0.04em] text-white">
            Configure one interview in a single screen.
          </h3>
          <p className="max-w-2xl text-white/64">
            Choose the target role, session mode, and optional coaching signals. The live
            flow will adapt in real time and write transcript, rubric, memory, and flag
            data as you go.
          </p>
        </div>

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

        <div className="grid gap-4 md:grid-cols-3">
          {INTERVIEW_MODES.map((item) => (
            <ModeSelectionCard
              key={item.value}
              label={item.label}
              description={item.description}
              selected={mode === item.value}
              compact
              onSelect={() => setMode(item.value)}
            />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Optional focus area</span>
            <input
              className="field"
              placeholder="Leadership, debugging, prioritization"
              value={focusArea}
              onChange={(event) => setFocusArea(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Confidence self-rating</span>
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
        </div>

        <label className="grid gap-2">
          <span className="text-sm text-white/74">Optional notes or context</span>
          <textarea
            className="field min-h-28 resize-none"
            placeholder="Anything the interviewer should know about your goal, role, or interview constraints."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Resume context</p>
              <p className="text-sm text-white/58">
                Upload a PDF, text, Word, or RTF resume so the interviewer can ask from your real experience. Your latest resume is saved to your account until you replace or remove it.
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
                {parsingResume ? "Reading resume..." : resumeText ? "Replace resume" : "Upload resume"}
              </span>
            </label>
          </div>

          {resumeText ? (
            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm text-white/68">
              <p className="font-medium text-white">{resumeFileName ?? "Resume uploaded"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/42">
                Saved to your account
              </p>
              <p className="mt-1 text-white/56">
                {resumeHighlights.length
                  ? `Highlights: ${resumeHighlights.join(" | ")}`
                  : "Resume text was loaded and will be used as interview context."}
              </p>
              <button
                type="button"
                className="mt-3 text-sm text-white/58 underline-offset-4 hover:text-white hover:underline"
                onClick={handleResumeRemoval}
                disabled={removingResume}
              >
                {removingResume ? "Removing resume..." : "Remove saved resume"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/48">
              PDF, text, Word, and RTF resumes are supported. Text-based PDFs parse best; scanned PDFs still need OCR, which is not in this MVP yet.
            </p>
          )}
        </div>

        <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5 md:grid-cols-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-sky-300"
              checked={personalizationEnabled}
              onChange={(event) => setPersonalizationEnabled(event.target.checked)}
            />
            <span className="space-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                Use prior personalization
                <Tooltip label="Reuses long-term memory and recurring weak skills when historical context exists.">
                  <span className="text-white/45">?</span>
                </Tooltip>
              </span>
              <span className="block text-sm text-white/58">
                {personalizationAvailable
                  ? "Historical context is available for this demo user."
                  : "No prior history found yet. The system will still run safely without it."}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-sky-300"
              checked={selfCritiqueEnabled}
              onChange={(event) => setSelfCritiqueEnabled(event.target.checked)}
            />
            <span className="space-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                Enable evaluator self-critique
                <Tooltip label="Adds a short reflection on rubric coverage and question quality in the results view.">
                  <span className="text-white/45">?</span>
                </Tooltip>
              </span>
              <span className="block text-sm text-white/58">
                Useful for demoing future flow improvement and rubric coverage.
              </span>
            </span>
          </label>
        </div>

        {error ? <Toast title={error} tone="error" /> : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-white/58">
            The session will include adaptive follow-ups, structured evaluation, stored
            transcript history, and mentor-visible flags when guardrails trigger.
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Starting session..." : "Launch Interview"}
          </Button>
        </div>
      </Card>

      <Card className="rounded-[34px] p-7">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Session preview</p>
        <div className="mt-5 grid gap-4">
          {[
            `Mode: ${INTERVIEW_MODES.find((item) => item.value === mode)?.label}`,
            `Role: ${targetRole || "Target role required"}`,
            `Adaptive signals: confidence, prior answer content, ${personalizationEnabled ? "historical weaknesses" : "no prior memory"}`,
            `Resume context: ${resumeText ? "saved and ready for question selection" : "not uploaded"}`,
            `Feedback: rubric scores, STAR breakdown, growth tips${selfCritiqueEnabled ? ", self-critique" : ""}`
          ].map((item) => (
            <div
              key={item}
              className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70"
            >
              {item}
            </div>
          ))}
        </div>
      </Card>
    </form>
  );
}
