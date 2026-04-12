"use client";

import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";

import { MAX_QUESTIONS_PER_SESSION } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { ConversationBubble } from "@/components/interview/conversation-bubble";
import { AnswerComposer } from "@/components/interview/answer-composer";
import { AlertBanner } from "@/components/interview/alert-banner";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import type { AskQuestionContext, RealtimeEventEnvelope, SessionSummary } from "@/lib/types";

function isTerminalSession(summary: SessionSummary) {
  return (
    summary.session.status === "completed" ||
    summary.agent_runtime.current_phase === "session_feedback"
  );
}

function buildAskQuestionContext(params: {
  summary: SessionSummary;
  contextItems: AskQuestionContext["recalled_context_items"];
  weakSkills: string[];
}): AskQuestionContext {
  return {
    mode: params.summary.session.mode,
    target_role: params.summary.session.target_role,
    focus_area: params.summary.session.focus_area ?? null,
    personalization_enabled: params.summary.session.personalization_enabled,
    self_critique_enabled: params.summary.session.self_critique_enabled,
    resume_text: params.summary.session.resume_text ?? null,
    recalled_context_summary: params.summary.session.recalled_context_summary ?? null,
    session_status: params.summary.session.status,
    transcript: params.summary.messages.map((message) => ({
      speaker_type: message.speaker_type,
      content: message.content,
      question_type:
        message.speaker_type === "interviewer"
          ? ((message.meta?.question_type as
              | AskQuestionContext["transcript"][number]["question_type"]
              | undefined) ?? null)
          : undefined
    })),
    current_phase: params.summary.agent_runtime.current_phase,
    previous_phase: null,
    turn_count: params.summary.agent_runtime.turn_count,
    redirect_count: 0,
    turn_type: params.summary.agent_runtime.turn_type,
    conversation_summary:
      params.summary.agent_runtime.conversation_summary ??
      params.summary.session.recalled_context_summary ??
      null,
    weak_skills: params.weakSkills,
    recalled_context_items: params.contextItems,
    flagged: params.summary.agent_runtime.flagged,
    mentor_takeover_active: params.summary.agent_runtime.mentor_takeover_active
  };
}

export function LiveInterviewClient({
  initialSummary
}: {
  initialSummary: SessionSummary;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );
  const hasBootstrapped = useRef(false);

  const activeQuestion = useMemo(
    () =>
      [...summary.messages]
        .reverse()
        .find((message) => message.speaker_type === "interviewer"),
    [summary.messages]
  );
  const answerCount = summary.messages.filter(
    (message) => message.speaker_type === "student"
  ).length;
  const latestEvaluation = summary.evaluations[summary.evaluations.length - 1] ?? null;
  const composerDisabled =
    loading ||
    paused ||
    isTerminalSession(summary) ||
    summary.session.status === "paused" ||
    summary.agent_runtime.mentor_takeover_active;

  const refreshSummary = useCallback(async () => {
    const response = await fetch(`/session/${summary.session.session_id}/summary`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to refresh session state.");
    }
    setSummary(payload);
    return payload as SessionSummary;
  }, [summary.session.session_id]);

  useEffect(() => {
    if (!isTerminalSession(summary)) {
      return;
    }

    startTransition(() => {
      router.push(`/results/${summary.session.session_id}`);
    });
  }, [router, summary]);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }

    const source = new EventSource(
      `/events/stream?scope=session&session_id=${encodeURIComponent(summary.session.session_id)}`
    );
    const eventTypes: RealtimeEventEnvelope["type"][] = [
      "session.flag.created",
      "session.mentor.feedback",
      "session.mentor.takeover"
    ];

    const handleRealtimeEvent = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      let envelope: RealtimeEventEnvelope | null = null;

      try {
        envelope = JSON.parse(event.data) as RealtimeEventEnvelope;
      } catch {
        return;
      }

      void refreshSummary().catch(() => {
        setToast({
          title: "A live mentor or guardrail update arrived, but the session summary could not refresh.",
          tone: "error"
        });
      });

      if (envelope.type === "session.mentor.takeover") {
        setPaused(true);
        setToast({
          title: "A mentor takeover is now active. The session has been paused.",
          tone: "info"
        });
        return;
      }

      if (envelope.type === "session.flag.created") {
        setToast({
          title: "A guardrail flag was recorded and shared with the mentor dashboard.",
          tone: "info"
        });
        return;
      }

      if (envelope.type === "session.mentor.feedback") {
        setToast({
          title: "New mentor feedback is available in this session.",
          tone: "info"
        });
      }
    };

    for (const eventType of eventTypes) {
      source.addEventListener(eventType, handleRealtimeEvent as EventListener);
    }

    return () => {
      for (const eventType of eventTypes) {
        source.removeEventListener(eventType, handleRealtimeEvent as EventListener);
      }
      source.close();
    };
  }, [refreshSummary, summary.session.session_id]);

  const requestQuestion = useCallback(async (
    latestAnswer: string | null,
    summarySnapshot: SessionSummary
  ) => {
    const recallResponse = await fetch("/memory/recall_context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: summarySnapshot.session.session_id,
        query_type: summarySnapshot.session.personalization_enabled ? "mixed" : "short_term",
        query_text: [latestAnswer, summarySnapshot.session.target_role, summarySnapshot.session.focus_area]
          .filter(Boolean)
          .join(" ")
      })
    });
    const recallPayload = await recallResponse.json();
    if (!recallResponse.ok) {
      throw new Error(recallPayload.error ?? "Unable to load orchestrator context.");
    }

    const response = await fetch("/ask_question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session_id: summarySnapshot.session.session_id,
        latest_answer: latestAnswer,
        context: buildAskQuestionContext({
          summary: summarySnapshot,
          contextItems: Array.isArray(recallPayload.context_items)
            ? recallPayload.context_items
            : [],
          weakSkills: Array.isArray(recallPayload.weak_skills)
            ? recallPayload.weak_skills.filter(
                (item: unknown): item is string => typeof item === "string"
              )
            : []
        })
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to generate the next question.");
    }
  }, []);

  useEffect(() => {
    if (hasBootstrapped.current || summary.messages.some((message) => message.speaker_type === "interviewer")) {
      hasBootstrapped.current = true;
      return;
    }

    hasBootstrapped.current = true;

    (async () => {
      setLoading(true);
      try {
        await requestQuestion(null, summary);
        await refreshSummary();
      } catch (error) {
        setToast({
          title:
            error instanceof Error
              ? error.message
              : "Unable to generate the opening question.",
          tone: "error"
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [summary, summary.messages, refreshSummary, requestQuestion]);

  async function submitAnswer() {
    if (!activeQuestion || !answer.trim() || composerDisabled) {
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      const evaluationResponse = await fetch("/evaluate_response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: summary.session.session_id,
          question_text: activeQuestion.content,
          answer_text: answer,
          target_role: summary.session.target_role,
          mode: summary.session.mode,
          self_critique_enabled: summary.session.self_critique_enabled
        })
      });
      const evaluationPayload = await evaluationResponse.json();
      if (!evaluationResponse.ok) {
        throw new Error(evaluationPayload.error ?? "Unable to evaluate the response.");
      }

      const refreshedSummary = await refreshSummary();
      const nextAnswerCount = answerCount + 1;
      setAnswer("");

      if (nextAnswerCount >= MAX_QUESTIONS_PER_SESSION) {
        await fetch(`/session/${summary.session.session_id}/end`, { method: "POST" });
        startTransition(() => {
          router.push(`/results/${summary.session.session_id}`);
        });
        return;
      }

      await requestQuestion(answer, refreshedSummary);
      const updatedSummary = await refreshSummary();
      if (isTerminalSession(updatedSummary)) {
        startTransition(() => {
          router.push(`/results/${summary.session.session_id}`);
        });
        return;
      }
      setToast({
        title: "Answer evaluated and next question generated.",
        tone: "success"
      });
    } catch (error) {
      setToast({
        title:
          error instanceof Error ? error.message : "Unable to process the answer right now.",
        tone: "error"
      });
    } finally {
      setLoading(false);
    }
  }

  async function endInterview() {
    setLoading(true);

    try {
      await fetch(`/session/${summary.session.session_id}/end`, { method: "POST" });
      startTransition(() => {
        router.push(`/results/${summary.session.session_id}`);
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell py-10">
      <div className="grid gap-6">
        <Card className="rounded-[34px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">
                {summary.session.mode} interview
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                {summary.session.target_role}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{summary.session.status}</Badge>
              <Badge>{summary.agent_runtime.current_phase}</Badge>
              <Badge>Question {Math.min(answerCount + 1, MAX_QUESTIONS_PER_SESSION)} / {MAX_QUESTIONS_PER_SESSION}</Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPaused((value) => !value)}
                disabled={summary.agent_runtime.mentor_takeover_active}
              >
                {summary.agent_runtime.mentor_takeover_active
                  ? "Mentor active"
                  : paused
                    ? "Continue"
                    : "Pause"}
              </Button>
              <Button variant="secondary" size="sm" onClick={endInterview} disabled={loading}>
                End interview
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr_0.72fr]">
          <Card className="space-y-4 rounded-[34px] p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Interview context</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Session cues</h2>
            </div>
            <div className="grid gap-3 text-sm text-white/68">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-white/42">Mode</p>
                <p className="mt-1 text-white">{summary.session.mode}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-white/42">Focus area</p>
                <p className="mt-1 text-white">{summary.session.focus_area ?? "Balanced practice"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-white/42">Personalization</p>
                <p className="mt-1 text-white">
                  {summary.session.personalization_enabled ? "Active" : "Off"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-white/42">Resume context</p>
                <p className="mt-1 text-white">
                  {summary.session.resume_text ? "Loaded" : "Not uploaded"}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-white/42">Current phase</p>
                <p className="mt-1 text-white">{summary.agent_runtime.current_phase}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-white/42">Started</p>
                <p className="mt-1 text-white">{formatDateTime(summary.session.started_at)}</p>
              </div>
            </div>
          </Card>

          <section className="grid gap-5">
            {summary.flags.length ? (
              <AlertBanner
                title="Guardrail monitoring active"
                description="A flagged event was recorded. The session remains supportive and the mentor dashboard has the full transcript context."
                tone="warning"
              />
            ) : null}
            {summary.mentorInterventions.some(
              (intervention) => intervention.intervention_type === "takeover"
            ) ? (
              <AlertBanner
                title="Mentor takeover is active"
                description="The session is paused while a mentor provides live intervention guidance."
                tone="safe"
              />
            ) : null}

            <Card className="rounded-[34px] p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/45">Conversation</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                    Transcript builds in real time.
                  </h2>
                </div>
                <Link href={`/results/${summary.session.session_id}`} className="text-sm text-white/58 underline-offset-4 hover:underline">
                  Preview results
                </Link>
              </div>
              <div className="grid max-h-[620px] gap-4 overflow-y-auto pr-1">
                {summary.messages.length ? (
                  summary.messages.map((message) => (
                    <ConversationBubble key={message.message_id} message={message} />
                  ))
                ) : (
                  <LoadingSkeleton className="h-28 rounded-[28px]" />
                )}
                {loading ? <LoadingSkeleton className="h-28 rounded-[28px]" /> : null}
              </div>
            </Card>

            {toast ? <Toast title={toast.title} tone={toast.tone} /> : null}

            <AnswerComposer
              value={answer}
              onChange={setAnswer}
              onSubmit={submitAnswer}
              disabled={composerDisabled}
              onHint={() =>
                setToast({
                  title:
                    summary.session.mode === "behavioral"
                      ? "Anchor your answer in STAR: context, your responsibility, the action you took, and the measurable result."
                      : summary.session.mode === "technical"
                        ? "Lead with requirements, then state the main tradeoff and one risk."
                        : "State the goal, assumptions, recommendation, and one success metric.",
                  tone: "info"
                })
              }
              onRepeat={() =>
                setToast({
                  title: activeQuestion?.content ?? "No active question yet.",
                  tone: "info"
                })
              }
            />
          </section>

          <div className="grid gap-6">
            <Card className="rounded-[34px] p-6">
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Live insights</p>
              {latestEvaluation ? (
                <div className="mt-5 grid gap-3">
                  {[
                    ["Clarity", latestEvaluation.clarity_score],
                    ["Structure", latestEvaluation.structure_score],
                    ["Relevance", latestEvaluation.relevance_score],
                    ["Soft skills", latestEvaluation.soft_skills_score]
                  ].map(([label, score]) => (
                    <div key={label} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/58">{label}</span>
                        <span className="text-white">{score} / 5</span>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm text-white/64">
                    {latestEvaluation.overall_summary}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/62">
                  Scores and feedback will appear here after the first answer is evaluated.
                </p>
              )}
            </Card>

            <Card className="rounded-[34px] p-6">
              <p className="text-xs uppercase tracking-[0.28em] text-white/45">Personalization summary</p>
              <p className="mt-4 text-sm leading-7 text-white/66">
                {summary.session.recalled_context_summary ??
                  "No prior memory was recalled for this session. The interviewer will adapt only to the live conversation."}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
