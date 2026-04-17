"use client";

import Link from "next/link";
import type { MutableRefObject } from "react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX } from "lucide-react";

import {
  DEFAULT_QUESTIONS_PER_SESSION,
  INTERVIEW_TTS_VOICE_OPTIONS,
  TTS_VOICE_STORAGE_KEY
} from "@/lib/constants";
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

const AUTO_SUBMITTED_TIMEOUT_ANSWER =
  "I ran out of time before I could submit an answer.";

const MUTE_QUESTIONS_STORAGE_KEY = "vantage_interview_mute_questions";

function playBlobAudio(
  blob: Blob,
  speechRef: MutableRefObject<HTMLAudioElement | null>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    speechRef.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      speechRef.current = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      speechRef.current = null;
      reject(new Error("Audio playback failed"));
    };
    void audio.play().catch((error) => {
      URL.revokeObjectURL(url);
      speechRef.current = null;
      reject(error instanceof Error ? error : new Error("Audio playback failed"));
    });
  });
}

function formatTimerLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

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
    question_limit: params.summary.session.question_limit ?? null,
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
    mentor_takeover_active: false
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
  const [remainingTimeSeconds, setRemainingTimeSeconds] = useState<number | null>(null);
  const [toast, setToast] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );
  const hasBootstrapped = useRef(false);
  const timerQuestionIdRef = useRef<string | null>(null);
  const timerDeadlineRef = useRef<number | null>(null);
  const timerStartedForMessageIdRef = useRef<string | null>(null);
  const autoSubmittedQuestionIdRef = useRef<string | null>(null);
  const transcribePauseStartRef = useRef<number | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenQuestionIdRef = useRef<string | null>(null);
  const unmuteQuestionOnlyRef = useRef(false);
  const introTtsCompletedRef = useRef(false);

  const [answerTranscribing, setAnswerTranscribing] = useState(false);
  const [questionAudioMuted, setQuestionAudioMuted] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("alloy");

  useEffect(() => {
    try {
      setQuestionAudioMuted(localStorage.getItem(MUTE_QUESTIONS_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TTS_VOICE_STORAGE_KEY);
      if (stored && INTERVIEW_TTS_VOICE_OPTIONS.some((option) => option.value === stored)) {
        setTtsVoice(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
  const questionLimit = summary.session.question_limit ?? DEFAULT_QUESTIONS_PER_SESSION;
  const latestEvaluation = summary.evaluations[summary.evaluations.length - 1] ?? null;
  const questionTimeLimitSeconds = summary.session.question_time_limit_seconds ?? null;

  const openingIntroMessage = useMemo(
    () =>
      summary.messages.find(
        (message) =>
          message.speaker_type === "interviewer" &&
          (message.meta as { opening_intro?: boolean } | undefined)?.opening_intro
      ) ?? null,
    [summary.messages]
  );

  const startTimerForQuestion = useCallback(
    (messageId: string) => {
      if (!questionTimeLimitSeconds) {
        return;
      }
      if (timerStartedForMessageIdRef.current === messageId) {
        return;
      }
      timerStartedForMessageIdRef.current = messageId;
      timerQuestionIdRef.current = messageId;
      timerDeadlineRef.current = Date.now() + questionTimeLimitSeconds * 1000;
      setRemainingTimeSeconds(questionTimeLimitSeconds);
    },
    [questionTimeLimitSeconds]
  );
  const sessionBlocksTimer =
    loading ||
    paused ||
    isTerminalSession(summary) ||
    summary.session.status === "paused";
  const composerDisabled = sessionBlocksTimer || answerTranscribing;

  const handleAnswerTranscribingChange = useCallback((active: boolean) => {
    if (active) {
      transcribePauseStartRef.current = Date.now();
      setAnswerTranscribing(true);
      return;
    }
    if (transcribePauseStartRef.current && timerDeadlineRef.current) {
      timerDeadlineRef.current += Date.now() - transcribePauseStartRef.current;
    }
    transcribePauseStartRef.current = null;
    setAnswerTranscribing(false);
  }, []);

  const toggleQuestionAudioMute = useCallback(() => {
    setQuestionAudioMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_QUESTIONS_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) {
        speechAudioRef.current?.pause();
        speechAudioRef.current = null;
      } else {
        unmuteQuestionOnlyRef.current = true;
        introTtsCompletedRef.current = true;
        lastSpokenQuestionIdRef.current = null;
      }
      return next;
    });
  }, []);
  const timerLabel = questionTimeLimitSeconds
    ? `Time left ${formatTimerLabel(remainingTimeSeconds ?? questionTimeLimitSeconds)}`
    : null;
  const timerTone =
    remainingTimeSeconds !== null && remainingTimeSeconds <= 10
      ? "danger"
      : remainingTimeSeconds !== null && remainingTimeSeconds <= 30
        ? "warning"
        : "default";

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
      "session.ended"
    ];

    const handleRealtimeEvent = (rawEvent: Event) => {
      const event = rawEvent as MessageEvent<string>;
      let envelope: RealtimeEventEnvelope | null = null;

      try {
        envelope = JSON.parse(event.data) as RealtimeEventEnvelope;
      } catch {
        return;
      }

      const resolved = envelope;

      void (async () => {
        try {
          await refreshSummary();
        } catch {
          setToast({
            title: "A live mentor or guardrail update arrived, but the session summary could not refresh.",
            tone: "error"
          });
          return;
        }

        if (!resolved) {
          return;
        }

        if (resolved.type === "session.ended") {
          const reason = resolved.payload?.reason;
          if (reason === "guardrail_auto_end") {
            setToast({
              title:
                "Your session was ended automatically due to a policy concern. A mentor will reach out to you soon.",
              tone: "info"
            });
          }
          return;
        }


        if (resolved.type === "session.flag.created") {
          setToast({
            title: "A guardrail flag was recorded and shared with the mentor dashboard.",
            tone: "info"
          });
          return;
        }

        if (resolved.type === "session.mentor.feedback") {
          setToast({
            title: "New mentor feedback is available in this session.",
            tone: "info"
          });
          return;
        }

        // No live takeover/chat events in this build.
      })();
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

  useEffect(() => {
    if (paused) {
      speechAudioRef.current?.pause();
      speechAudioRef.current = null;
    }
  }, [paused]);

  useEffect(() => {
    if (!questionTimeLimitSeconds || !activeQuestion?.message_id) {
      timerStartedForMessageIdRef.current = null;
      timerQuestionIdRef.current = null;
      timerDeadlineRef.current = null;
      autoSubmittedQuestionIdRef.current = null;
      setRemainingTimeSeconds(null);
      return;
    }

    timerStartedForMessageIdRef.current = null;
    timerQuestionIdRef.current = null;
    timerDeadlineRef.current = null;
    autoSubmittedQuestionIdRef.current = null;
    setRemainingTimeSeconds(null);
  }, [activeQuestion?.message_id, questionTimeLimitSeconds]);

  const sessionIsTerminal =
    summary.session.status === "completed" ||
    summary.agent_runtime.current_phase === "session_feedback";

  useEffect(() => {
    if (!activeQuestion?.message_id || !activeQuestion.content.trim() || sessionIsTerminal) {
      return;
    }

    if (lastSpokenQuestionIdRef.current === activeQuestion.message_id) {
      return;
    }

    if (questionAudioMuted) {
      lastSpokenQuestionIdRef.current = activeQuestion.message_id;
      startTimerForQuestion(activeQuestion.message_id);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const speak = async (text: string) => {
        const response = await fetch("/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: ttsVoice })
        });
        if (cancelled) {
          return false;
        }
        if (!response.ok) {
          throw new Error("Speech request failed.");
        }
        const blob = await response.blob();
        if (cancelled) {
          return false;
        }
        await playBlobAudio(blob, speechAudioRef);
        return true;
      };

      try {
        const unmuteOnly = unmuteQuestionOnlyRef.current;
        if (unmuteOnly) {
          unmuteQuestionOnlyRef.current = false;
        }

        if (
          !unmuteOnly &&
          openingIntroMessage &&
          !introTtsCompletedRef.current &&
          openingIntroMessage.message_id !== activeQuestion.message_id
        ) {
          const introOk = await speak(openingIntroMessage.content);
          introTtsCompletedRef.current = true;
          if (!introOk || cancelled) {
            return;
          }
        }

        const questionOk = await speak(activeQuestion.content);
        if (!questionOk || cancelled) {
          return;
        }

        lastSpokenQuestionIdRef.current = activeQuestion.message_id;
        startTimerForQuestion(activeQuestion.message_id);
      } catch {
        if (cancelled) {
          return;
        }
        lastSpokenQuestionIdRef.current = activeQuestion.message_id;
        startTimerForQuestion(activeQuestion.message_id);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    activeQuestion?.content,
    activeQuestion?.message_id,
    openingIntroMessage,
    questionAudioMuted,
    sessionIsTerminal,
    startTimerForQuestion,
    ttsVoice
  ]);

  useEffect(() => {
    if (
      !questionTimeLimitSeconds ||
      !activeQuestion?.message_id ||
      remainingTimeSeconds === null
    ) {
      return undefined;
    }

    if (sessionBlocksTimer) {
      return undefined;
    }

    if (!timerDeadlineRef.current) {
      timerDeadlineRef.current = Date.now() + remainingTimeSeconds * 1000;
    }

    const updateRemaining = () => {
      if (answerTranscribing) {
        return;
      }
      if (!timerDeadlineRef.current) {
        return;
      }

      const nextRemaining = Math.max(
        0,
        Math.ceil((timerDeadlineRef.current - Date.now()) / 1000)
      );

      setRemainingTimeSeconds((current) =>
        current === nextRemaining ? current : nextRemaining
      );
    };

    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeQuestion?.message_id,
    answerTranscribing,
    questionTimeLimitSeconds,
    remainingTimeSeconds,
    sessionBlocksTimer
  ]);

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
        const introResponse = await fetch(
          `/session/${summary.session.session_id}/opening_intro`,
          { method: "POST" }
        );
        if (introResponse.ok) {
          const introPayload = (await introResponse.json()) as { skipped?: boolean };
          if (!introPayload.skipped) {
            await refreshSummary();
          }
        }
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

  const submitAnswer = useCallback(async (options?: {
    answerOverride?: string;
    timedOut?: boolean;
  }) => {
    if (!activeQuestion || composerDisabled) {
      return;
    }

    const trimmedAnswer = options?.answerOverride?.trim() ?? answer.trim();

    if (!trimmedAnswer) {
      return;
    }

    setLoading(true);
    setToast(null);
    timerDeadlineRef.current = null;

    try {
      const evaluationResponse = await fetch("/evaluate_response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: summary.session.session_id,
          question_message_id: activeQuestion.message_id,
          question_text: activeQuestion.content,
          answer_text: trimmedAnswer,
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
      // Next question's timer starts only after TTS finishes (or immediately if muted)—see speech effect.

      if (nextAnswerCount >= questionLimit) {
        await fetch(`/session/${summary.session.session_id}/end`, { method: "POST" });
        startTransition(() => {
          router.push(`/results/${summary.session.session_id}`);
        });
        return;
      }

      await requestQuestion(trimmedAnswer, refreshedSummary);
      const updatedSummary = await refreshSummary();
      if (isTerminalSession(updatedSummary)) {
        startTransition(() => {
          router.push(`/results/${summary.session.session_id}`);
        });
        return;
      }
      setToast({
        title: options?.timedOut
          ? "Time expired. Your answer was auto-submitted and the next question is ready."
          : "Answer evaluated and next question generated.",
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
  }, [
    activeQuestion,
    answer,
    answerCount,
    composerDisabled,
    questionLimit,
    refreshSummary,
    requestQuestion,
    router,
    summary.session.mode,
    summary.session.self_critique_enabled,
    summary.session.session_id,
    summary.session.target_role
  ]);

  useEffect(() => {
    if (
      !questionTimeLimitSeconds ||
      !activeQuestion?.message_id ||
      remainingTimeSeconds !== 0 ||
      composerDisabled ||
      autoSubmittedQuestionIdRef.current === activeQuestion.message_id
    ) {
      return;
    }

    autoSubmittedQuestionIdRef.current = activeQuestion.message_id;
    void submitAnswer({
      answerOverride: answer.trim() || AUTO_SUBMITTED_TIMEOUT_ANSWER,
      timedOut: true
    });
  }, [
    activeQuestion?.message_id,
    answer,
    composerDisabled,
    questionTimeLimitSeconds,
    remainingTimeSeconds,
    submitAnswer
  ]);

  async function endInterview() {
    speechAudioRef.current?.pause();
    speechAudioRef.current = null;
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
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
                {summary.session.target_role}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{summary.session.status}</Badge>
              <Badge>{summary.agent_runtime.current_phase}</Badge>
              <Badge>Question {Math.min(answerCount + 1, questionLimit)} / {questionLimit}</Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPaused((value) => {
                    if (!value) {
                      speechAudioRef.current?.pause();
                      speechAudioRef.current = null;
                    }
                    return !value;
                  });
                }}
              >
                {paused ? "Continue" : "Pause"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={toggleQuestionAudioMute}
                title={
                  questionAudioMuted
                    ? "Unmute: read questions aloud"
                    : "Mute: do not read questions aloud"
                }
              >
                {questionAudioMuted ? (
                  <>
                    <VolumeX className="mr-2 inline h-4 w-4" aria-hidden />
                    Questions muted
                  </>
                ) : (
                  <>
                    <Volume2 className="mr-2 inline h-4 w-4" aria-hidden />
                    Question audio on
                  </>
                )}
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
                <p className="text-white/42">Question timer</p>
                <p className="mt-1 text-white">
                  {questionTimeLimitSeconds
                    ? `${Math.floor(questionTimeLimitSeconds / 60) > 0
                        ? `${Math.floor(questionTimeLimitSeconds / 60)} min `
                        : ""}${questionTimeLimitSeconds % 60 ? `${questionTimeLimitSeconds % 60} sec` : ""}`.trim()
                    : "No limit"}
                </p>
                {questionTimeLimitSeconds && !questionAudioMuted ? (
                  <p className="mt-2 text-xs text-white/45">
                    Timer starts after the question is read aloud (after the short intro on the first
                    question).
                  </p>
                ) : null}
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
              onSubmit={() => void submitAnswer()}
              disabled={composerDisabled}
              timerLabel={timerLabel}
              timerTone={timerTone}
              onTranscribingChange={handleAnswerTranscribingChange}
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
