import { z } from "zod";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

import { DEFAULT_QUESTIONS_PER_SESSION } from "@/lib/constants";
import { logEvent } from "@/lib/logging";
import { QUESTION_BANK, renderQuestionTemplate } from "@/lib/services/question-bank";
import { clampScore } from "@/lib/utils";
import type {
  AgentPhase,
  AnalyzerOutput,
  EvaluationDimensionId,
  EvaluationRubric,
  InterviewMode,
  QuestionCategory,
  RawEvaluationScorecard
} from "@/lib/types";

type QuestionGenerationSource = "openai" | "gemini" | "deterministic";

function aiAbortSignal() {
  const ms = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 120_000;
  return AbortSignal.timeout(timeoutMs);
}

const analyzerSchema = z.object({
  summary: z.string(),
  answer_quality: z.enum(["limited", "solid", "strong"]),
  question_type_hint: z.enum(["primary", "follow_up", "situational", "clarifying"]),
  follow_up_targets: z.array(z.string()).max(4),
  missing_signals: z.array(z.string()).max(4),
  suggested_phase: z.enum([
    "interview_setup",
    "opening",
    "interview_round",
    "deep_dive",
    "session_feedback",
    "mentor_review"
  ]),
  probe_target_skill: z.string().nullable().optional(),
  phase_change_reason: z.string().nullable().optional(),
  star_coverage: z
    .object({
      situation: z.boolean(),
      task: z.boolean(),
      action: z.boolean(),
      result: z.boolean()
    })
    .optional()
});

const analyzerGeminiSchema = z.object({
  summary: z.string(),
  answer_quality: z.enum(["limited", "solid", "strong"]),
  question_type_hint: z.enum(["primary", "follow_up", "situational", "clarifying"]),
  follow_up_targets: z.array(z.string()).max(4),
  missing_signals: z.array(z.string()).max(4),
  suggested_phase: z.enum([
    "interview_setup",
    "opening",
    "interview_round",
    "deep_dive",
    "session_feedback",
    "mentor_review"
  ]),
  probe_target_skill: z.string(),
  phase_change_reason: z.string(),
  star_coverage: z.object({
    situation: z.boolean(),
    task: z.boolean(),
    action: z.boolean(),
    result: z.boolean()
  })
});

const evaluationSchema = z.object({
  clarity_score: z.number().min(1).max(5),
  structure_score: z.number().min(1).max(5),
  relevance_score: z.number().min(1).max(5),
  soft_skills_score: z.number().min(1).max(5),
  star: z.object({
    situation: z.string(),
    task: z.string(),
    action: z.string(),
    result: z.string()
  }),
  overall_summary: z.string(),
  actionable_feedback: z.array(z.string()).min(1).max(4),
  growth_tips: z.array(z.string()).min(1).max(4),
  self_critique_output: z.string().nullable().optional()
});

const evaluationGeminiSchema = z.object({
  clarity_score: z.number().min(1).max(5),
  structure_score: z.number().min(1).max(5),
  relevance_score: z.number().min(1).max(5),
  soft_skills_score: z.number().min(1).max(5),
  star: z.object({
    situation: z.string(),
    task: z.string(),
    action: z.string(),
    result: z.string()
  }),
  overall_summary: z.string(),
  actionable_feedback: z.array(z.string()).min(1).max(4),
  growth_tips: z.array(z.string()).min(1).max(4),
  self_critique_output: z.string()
});

function emptyStringToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeGeminiAnalyzerOutput(
  result: z.infer<typeof analyzerGeminiSchema>
): AnalyzerOutput {
  return analyzerSchema.parse({
    ...result,
    probe_target_skill: emptyStringToNull(result.probe_target_skill),
    phase_change_reason: emptyStringToNull(result.phase_change_reason)
  });
}

function normalizeGeminiEvaluationOutput(
  result: z.infer<typeof evaluationGeminiSchema>,
  selfCritiqueEnabled: boolean
): RawEvaluationScorecard {
  return {
    clarity_score: clampScore(result.clarity_score),
    structure_score: clampScore(result.structure_score),
    relevance_score: clampScore(result.relevance_score),
    soft_skills_score: clampScore(result.soft_skills_score),
    star: result.star,
    overall_summary: result.overall_summary,
    actionable_feedback: result.actionable_feedback,
    growth_tips: result.growth_tips,
    self_critique_output: selfCritiqueEnabled
      ? emptyStringToNull(result.self_critique_output)
      : null
  };
}

function dimensionPriorityLookup(rubric: EvaluationRubric) {
  return rubric.feedback_priorities.reduce<Record<EvaluationDimensionId, number>>(
    (accumulator, id, index) => {
      accumulator[id] = index;
      return accumulator;
    },
    {
      clarity: 0,
      structure: 1,
      relevance: 2,
      soft_skills: 3
    }
  );
}

function dimensionScoreRange(
  rubric: EvaluationRubric,
  dimensionId: EvaluationDimensionId
) {
  const dimension = rubric.dimensions.find((entry) => entry.id === dimensionId);
  return {
    min: dimension?.scale_min ?? 1,
    max: dimension?.scale_max ?? 5
  };
}

function clampRubricScore(
  rubric: EvaluationRubric,
  dimensionId: EvaluationDimensionId,
  score: number
) {
  const range = dimensionScoreRange(rubric, dimensionId);
  return Math.min(range.max, Math.max(range.min, clampScore(score)));
}

function lowScoreFeedback(
  params: {
    dimensionId: EvaluationDimensionId;
    mode: InterviewMode;
    answerText: string;
    questionText: string;
    rubric: EvaluationRubric;
    missingStarFields: string[];
  }
) {
  switch (params.dimensionId) {
    case "clarity":
      return "Make the answer easier to follow by shortening the setup and using one clean thread from context to impact.";
    case "structure":
      return params.missingStarFields.length
        ? `Name the missing ${params.missingStarFields.join(", ")} step${params.missingStarFields.length > 1 ? "s" : ""} explicitly so the interviewer can track your logic.`
        : "Use a more explicit structure so the interviewer can see your reasoning without guessing.";
    case "relevance":
      return params.mode === "technical"
        ? "Tie the answer back to the technical prompt with clearer tradeoffs, constraints, and why your choice fits the role."
        : params.mode === "case"
          ? "Reconnect the answer to the stated goal and close with a clear recommendation."
          : "Tie the example back to the exact question and explain why it matters for the target role.";
    case "soft_skills":
      return "Show more ownership, collaboration, and communication judgment so the answer sounds stronger under interview pressure.";
  }
}

function growthTipForDimension(params: {
  dimensionId: EvaluationDimensionId;
  mode: InterviewMode;
}) {
  switch (params.dimensionId) {
    case "clarity":
      return "Practice a 30-second version first, then expand only where the interviewer needs more evidence.";
    case "structure":
      return params.mode === "technical"
        ? "Use the same sequence every time: requirements, design, tradeoffs, risks."
        : params.mode === "case"
          ? "Frame the objective, list assumptions, then end with one recommendation and one metric."
          : "Lead with Situation, name your Task, spend most of the answer on Action, and close with a Result.";
    case "relevance":
      return "Mirror the language of the prompt and explicitly connect your answer back to the target role.";
    case "soft_skills":
      return "Add one sentence that shows how you aligned others, handled disagreement, or communicated tradeoffs.";
  }
}

function currentProvider() {
  const configured = process.env.LLM_PROVIDER?.trim().toLowerCase();

  if (configured === "deterministic") {
    return "deterministic";
  }

  if (configured === "openai" && process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (configured === "gemini" && process.env.GOOGLE_API_KEY) {
    return "gemini";
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.GOOGLE_API_KEY) {
    return "gemini";
  }

  return "deterministic";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown";
}

function shouldUseOpenAI() {
  return currentProvider() === "openai" && Boolean(process.env.OPENAI_API_KEY);
}

function shouldUseGemini() {
  return currentProvider() === "gemini" && Boolean(process.env.GOOGLE_API_KEY);
}

const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"] as const;

function configuredGeminiModels() {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return Array.from(new Set([primary, ...GEMINI_FALLBACK_MODELS]));
}

function shouldTryFallbackModel(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const status = "status" in error && typeof error.status === "number" ? error.status : null;
  if (status === 429 || status === 403 || status === 404) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("too many requests") ||
    message.includes("not found") ||
    message.includes("unsupported model") ||
    message.includes("permission denied") ||
    message.includes("does not have permission") ||
    message.includes("rate limit")
  );
}

function geminiModel(modelName: string, temperature: number) {
  return new ChatGoogleGenerativeAI({
    model: modelName,
    temperature,
    maxRetries: 0,
    apiKey: process.env.GOOGLE_API_KEY
  });
}

function openAIModel(temperature: number) {
  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    temperature,
    maxRetries: 0,
    apiKey: process.env.OPENAI_API_KEY
  });
}

async function runGeminiWithFallback<T>(params: {
  temperature: number;
  invoke: (model: ChatGoogleGenerativeAI, modelName: string) => Promise<T>;
}) {
  const models = configuredGeminiModels();
  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const modelName = models[index];

    try {
      return await params.invoke(geminiModel(modelName, params.temperature), modelName);
    } catch (error) {
      lastError = error;
      const hasFallback = index < models.length - 1;

      if (hasFallback && shouldTryFallbackModel(error)) {
        const nextModel = models[index + 1];
        console.warn(
          `Gemini model ${modelName} failed. Trying fallback model ${nextModel}.`,
          error
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

function inferQuestionType(answer: string) {
  if (answer.length < 90) {
    return "clarifying" as const;
  }

  if (!/\bbecause\b|\bso that\b|\btherefore\b|\btradeoff\b/i.test(answer)) {
    return "follow_up" as const;
  }

  return "situational" as const;
}

function detectStarCoverage(answer: string) {
  return {
    situation: /\bsituation\b|\bcontext\b|\bwhen\b|\bduring\b/i.test(answer),
    task: /\btask\b|\bgoal\b|\bneeded to\b|\bresponsib/i.test(answer),
    action: /\baction\b|\bi did\b|\bdecided\b|\bimplemented\b/i.test(answer),
    result: /\bresult\b|\boutcome\b|\bimpact\b|\bimprov|\bshipped\b/i.test(answer)
  };
}

function textFromResponseContent(content: string | Array<{ text?: string }>) {
  if (typeof content === "string") {
    return content.trim();
  }

  return content
    .map((part) => ("text" in part ? part.text ?? "" : ""))
    .join("")
    .trim();
}

function extractStarSection(answer: string, label: "Situation" | "Task" | "Action" | "Result") {
  const pattern = new RegExp(
    `${label}\\s*:\\s*([\\s\\S]*?)(?=(Situation|Task|Action|Result)\\s*:|$)`,
    "i"
  );
  const match = answer.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function buildStarBreakdown(answerText: string) {
  const labeled = {
    situation: extractStarSection(answerText, "Situation"),
    task: extractStarSection(answerText, "Task"),
    action: extractStarSection(answerText, "Action"),
    result: extractStarSection(answerText, "Result")
  };

  if (Object.values(labeled).some(Boolean)) {
    return {
      situation:
        labeled.situation ?? "Situation was not clearly stated. Open with the context sooner.",
      task:
        labeled.task ?? "Task ownership was implied rather than explicitly named.",
      action:
        labeled.action ?? "Action could be more specific about your decisions and reasoning.",
      result:
        labeled.result ?? "Result needs a clearer outcome or measurable impact."
    };
  }

  const starSegments = answerText
    .split(/[.!?]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return {
    situation:
      starSegments[0] ?? "Situation was not clearly stated. Open with the context sooner.",
    task:
      starSegments[1] ?? "Task ownership was implied rather than explicitly named.",
    action:
      starSegments[2] ?? "Action could be more specific about your decisions and reasoning.",
    result:
      starSegments[3] ?? "Result needs a clearer outcome or measurable impact."
  };
}

function deterministicAnalysis(params: {
  latestAnswer: string;
  mode: InterviewMode;
  currentPhase: AgentPhase;
  answeredCount: number;
  questionLimit: number;
  weakSkills: string[];
}) {
  const star = detectStarCoverage(params.latestAnswer);
  const missingSignals: string[] = [];

  if (!star.situation) {
    missingSignals.push("clear context");
  }
  if (!star.action) {
    missingSignals.push("specific action");
  }
  if (!star.result) {
    missingSignals.push("measurable result");
  }
  if (params.mode === "technical" && !/\btradeoff\b|\brisk\b|\bconstraint\b/i.test(params.latestAnswer)) {
    missingSignals.push("tradeoff articulation");
  }
  if (params.mode === "case" && !/\bassumption\b|\bmetric\b|\brecommend/i.test(params.latestAnswer)) {
    missingSignals.push("recommendation structure");
  }

  const answer_quality =
    params.latestAnswer.trim().split(/\s+/).length < 30 || missingSignals.length >= 3
      ? "limited"
      : missingSignals.length >= 1
        ? "solid"
        : "strong";

  const followUpTargets = Array.from(
    new Set([...missingSignals, ...params.weakSkills.slice(0, 2)])
  ).slice(0, 3);
  const questionType = inferQuestionType(params.latestAnswer);
  const shouldDeepDive =
    params.currentPhase !== "deep_dive" &&
    (answer_quality === "limited" ||
      (params.mode === "behavioral"
        ? answer_quality === "solid" &&
          missingSignals.length >= 2 &&
          params.answeredCount > 0 &&
          params.answeredCount % 3 === 1
        : answer_quality === "solid" &&
          missingSignals.length >= 2 &&
          params.answeredCount > 0 &&
          params.answeredCount % 2 === 1));
  const suggested_phase =
    params.answeredCount >= params.questionLimit
      ? "session_feedback"
      : shouldDeepDive
        ? "deep_dive"
        : "interview_round";

  const summary =
    answer_quality === "strong"
      ? "The answer was credible and detailed enough to keep the main interview moving."
      : "The answer exposed useful gaps that justify a sharper follow-up.";

  return analyzerSchema.parse({
    summary,
    answer_quality,
    question_type_hint: questionType,
    follow_up_targets: followUpTargets,
    missing_signals: missingSignals,
    suggested_phase,
    probe_target_skill: followUpTargets[0] ?? null,
    phase_change_reason:
      suggested_phase === "deep_dive"
        ? "A deeper probe is needed before advancing."
        : suggested_phase === "session_feedback"
          ? "The configured question limit has been reached."
          : "The interview can continue in the main round.",
    star_coverage: star
  });
}

function fallbackQuestion(params: {
  mode: InterviewMode;
  phase: AgentPhase;
  targetRole: string;
  focusArea?: string | null;
  weakSkills: string[];
  resumeHighlights?: string[];
  latestAnswer?: string | null;
  followUpTargets?: string[];
  questionTypeHint?: QuestionCategory;
  answeredCount: number;
}) {
  if (params.phase === "session_feedback") {
    return {
      question:
        "Thank you for your time today. Reflect on one concrete example that shows stronger ownership, clearer actions, and a measurable result before your next practice session.",
      questionType: "primary" as const
    };
  }

  if (params.phase === "deep_dive" || params.questionTypeHint === "clarifying") {
    const target = params.followUpTargets?.[0] ?? params.weakSkills[0] ?? "your reasoning";
    if (params.mode === "technical") {
      return {
        question: `Go deeper on ${target}. What tradeoff or constraint mattered most, and why?`,
        questionType: "clarifying" as const
      };
    }

    if (params.mode === "case") {
      return {
        question: `Clarify ${target}. What assumption would you make explicit, and what metric would you watch first?`,
        questionType: "clarifying" as const
      };
    }

    return {
      question: `Go deeper on ${target}. What specifically did you do, and what measurable result followed?`,
      questionType: "clarifying" as const
    };
  }

  const modeQuestions = QUESTION_BANK.filter((entry) => entry.mode === params.mode);
  const focus = params.focusArea?.toLowerCase() ?? "";

  const pickQuestion = (categories: QuestionCategory[]) => {
    const matching = modeQuestions.filter((entry) => categories.includes(entry.category));
    const prioritized = focus
      ? [
          ...matching.filter((entry) => entry.focus.includes(focus)),
          ...matching.filter((entry) => !entry.focus.includes(focus))
        ]
      : matching;

    return prioritized[params.answeredCount % prioritized.length] ?? matching[0] ?? modeQuestions[0];
  };

  let template;

  if (params.mode === "behavioral") {
    template =
      params.phase === "opening" || params.phase === "interview_round"
        ? pickQuestion(
            params.answeredCount % 2 === 0 ? ["primary", "situational"] : ["situational", "primary"]
          )
        : pickQuestion(["primary", "situational"]);
  } else {
    const desiredType =
      params.questionTypeHint ??
      (params.latestAnswer ? inferQuestionType(params.latestAnswer) : "primary");
    template = pickQuestion([desiredType, "primary", "situational", "follow_up"]);
  }

  return {
    question: renderQuestionTemplate(template.template, {
      targetRole: params.targetRole,
      focusArea: params.focusArea,
      weakness: params.weakSkills[0] ?? null,
      resumeHighlight: params.resumeHighlights?.[params.answeredCount % (params.resumeHighlights.length || 1)] ?? null
    }),
    questionType: template.category
  };
}

function deterministicEvaluation(params: {
  answerText: string;
  questionText: string;
  mode: InterviewMode;
  selfCritiqueEnabled: boolean;
  rubric: EvaluationRubric;
  targetRole: string;
}): RawEvaluationScorecard {
  const wordCount = params.answerText.trim().split(/\s+/).filter(Boolean).length;
  const lowerAnswer = params.answerText.toLowerCase();
  const clarityBase = wordCount > 40 ? 4 : wordCount > 20 ? 3 : 2;
  const starCoverage = detectStarCoverage(params.answerText);
  const requiredStarFields = params.rubric.star_fields;
  const coveredRequiredStarFields = requiredStarFields.filter((field) => starCoverage[field]).length;
  const structureBonus =
    /\bfirst\b|\bthen\b|\bfinally\b|\bsituation\b|\btask\b|\baction\b|\bresult\b/i.test(
      params.answerText
    )
      ? 1
      : 0;
  const relevanceBonus = params.questionText
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .some((token) => lowerAnswer.includes(token))
    ? 1
    : 0;
  const softSkillBonus =
    /\bteam\b|\bmentor\b|\bcollaborat|\baligned\b|\bcommunicat|\bempathy\b/i.test(
      params.answerText
    )
      ? 1
      : 0;
  const roleModeBonus =
    params.mode === "technical" && /\btradeoff\b|\bscale\b|\bcache\b|\bapi\b/i.test(params.answerText)
      ? 1
      : params.mode === "behavioral" && /\blearned\b|\bfeedback\b|\bstakeholder\b/i.test(params.answerText)
        ? 1
        : params.mode === "case" && /\bpriorit|\bassumption\b|\bmetric\b/i.test(params.answerText)
          ? 1
          : 0;
  const star = buildStarBreakdown(params.answerText);
  const missingStarFields = requiredStarFields.filter((field) => !starCoverage[field]);
  const priorityLookup = dimensionPriorityLookup(params.rubric);

  const clarity = clampRubricScore(
    params.rubric,
    "clarity",
    clarityBase + relevanceBonus + (priorityLookup.clarity === 0 ? 1 : 0)
  );
  const structure = clampRubricScore(
    params.rubric,
    "structure",
    clarityBase -
      1 +
      structureBonus +
      (coveredRequiredStarFields >= Math.max(1, Math.ceil(requiredStarFields.length / 2)) ? 1 : 0) -
      (missingStarFields.length >= 2 ? 1 : 0)
  );
  const relevance = clampRubricScore(
    params.rubric,
    "relevance",
    clarityBase - 1 + relevanceBonus + roleModeBonus + (priorityLookup.relevance === 0 ? 1 : 0)
  );
  const softSkills = clampRubricScore(
    params.rubric,
    "soft_skills",
    clarityBase - 1 + softSkillBonus
  );
  const averageScore = (clarity + structure + relevance + softSkills) / 4;
  const dimensionScores: Record<EvaluationDimensionId, number> = {
    clarity,
    structure,
    relevance,
    soft_skills: softSkills
  };
  const prioritizedLowDimensions = params.rubric.dimensions
    .map((dimension) => ({
      ...dimension,
      score: dimensionScores[dimension.id]
    }))
    .filter(
      (dimension) =>
        dimension.score <=
        (dimension.weak_threshold ?? params.rubric.weak_skill_threshold)
    )
    .sort((left, right) => left.feedback_priority - right.feedback_priority)
    .slice(0, 2);

  const actionable_feedback = prioritizedLowDimensions.length
    ? prioritizedLowDimensions.map((dimension) =>
        lowScoreFeedback({
          dimensionId: dimension.id,
          mode: params.mode,
          answerText: params.answerText,
          questionText: params.questionText,
          rubric: params.rubric,
          missingStarFields
        })
      )
    : [
        `Keep the answer anchored to the ${params.rubric.rubric_id} rubric: concise setup, specific evidence, and a clear takeaway.`,
        /\b\d+[%x]?\b/.test(params.answerText)
          ? "Keep pairing your examples with concrete results."
          : "Add one metric or concrete outcome to make the impact more credible."
      ];

  const growth_tips = prioritizedLowDimensions.length
    ? prioritizedLowDimensions.map((dimension) =>
        growthTipForDimension({
          dimensionId: dimension.id,
          mode: params.mode
        })
      )
    : params.mode === "technical"
      ? [
          "Keep using a repeatable structure: requirements, design, tradeoffs, risks.",
          "State one failure mode and how you would mitigate it."
        ]
      : params.mode === "case"
        ? [
            "Lead with the goal, then list assumptions before proposing actions.",
            "Close with one recommendation and one success metric."
          ]
        : [
            "Practice a 45-second version of the story before expanding.",
            "End with a reflective takeaway that maps to the target role."
          ];

  return {
    clarity_score: clarity,
    structure_score: structure,
    relevance_score: relevance,
    soft_skills_score: softSkills,
    star,
    overall_summary:
      averageScore >= 4.25
        ? `Strong ${params.mode} response for ${params.targetRole} with evidence that aligns to rubric ${params.rubric.rubric_id}.`
        : averageScore >= 3.25
          ? `Solid foundation. The answer is viable, but the rubric still points to a few coaching areas before it becomes consistently persuasive.`
          : "Supportive reset needed. The answer has useful raw material, but the rubric shows missing structure or evidence that should be repaired next.",
    actionable_feedback,
    growth_tips: growth_tips.slice(0, 4),
    self_critique_output: params.selfCritiqueEnabled
      ? `Rubric ${params.rubric.rubric_id} covered ${params.rubric.dimensions.length} dimensions. ${missingStarFields.length ? `Missing evidence in ${missingStarFields.join(", ")} limited coverage.` : "Coverage was complete across the required structure fields."}`
      : null
  };
}

export async function analyzeInterviewTurn(params: {
  prompt: string;
  latestAnswer: string;
  mode: InterviewMode;
  currentPhase: AgentPhase;
  answeredCount: number;
  questionLimit: number;
  weakSkills: string[];
}): Promise<AnalyzerOutput> {
  if (shouldUseOpenAI()) {
    try {
      const model = openAIModel(0).withStructuredOutput(analyzerGeminiSchema, {
        name: "InterviewTurnAnalysis"
      });
      const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
      const normalized = normalizeGeminiAnalyzerOutput(analyzerGeminiSchema.parse(result));
      logEvent("ai.analyzer.completed", {
        provider: "openai",
        answered_count: params.answeredCount,
        current_phase: params.currentPhase,
        answer_quality: normalized.answer_quality,
        suggested_phase: normalized.suggested_phase
      });
      return normalized;
    } catch (error) {
      console.warn("OpenAI analyzer failed, falling back to deterministic analysis.", error);
      const fallback = deterministicAnalysis({
        latestAnswer: params.latestAnswer,
        mode: params.mode,
        currentPhase: params.currentPhase,
        answeredCount: params.answeredCount,
        questionLimit: params.questionLimit ?? DEFAULT_QUESTIONS_PER_SESSION,
        weakSkills: params.weakSkills
      });
      logEvent(
        "ai.analyzer.fallback",
        {
          provider: "openai",
          fallback_provider: "deterministic",
          answered_count: params.answeredCount,
          current_phase: params.currentPhase,
          suggested_phase: fallback.suggested_phase,
          reason: errorMessage(error)
        },
        "warn"
      );
      return fallback;
    }
  }

  if (!shouldUseGemini()) {
    const fallback = deterministicAnalysis({
      latestAnswer: params.latestAnswer,
      mode: params.mode,
      currentPhase: params.currentPhase,
      answeredCount: params.answeredCount,
      questionLimit: params.questionLimit ?? DEFAULT_QUESTIONS_PER_SESSION,
      weakSkills: params.weakSkills
    });
    logEvent("ai.analyzer.completed", {
      provider: "deterministic",
      answered_count: params.answeredCount,
      current_phase: params.currentPhase,
      answer_quality: fallback.answer_quality,
      suggested_phase: fallback.suggested_phase
    });
    return fallback;
  }

  try {
    const normalized = await runGeminiWithFallback({
      temperature: 0,
      invoke: async (baseModel) => {
        const model = baseModel.withStructuredOutput(analyzerGeminiSchema, {
          name: "InterviewTurnAnalysis",
          method: "jsonSchema"
        });
        const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
        return normalizeGeminiAnalyzerOutput(analyzerGeminiSchema.parse(result));
      }
    });
    logEvent("ai.analyzer.completed", {
      provider: "gemini",
      answered_count: params.answeredCount,
      current_phase: params.currentPhase,
      answer_quality: normalized.answer_quality,
      suggested_phase: normalized.suggested_phase
    });
    return normalized;
  } catch (error) {
    console.warn("Gemini analyzer failed, falling back to deterministic analysis.", error);
    const fallback = deterministicAnalysis({
      latestAnswer: params.latestAnswer,
      mode: params.mode,
      currentPhase: params.currentPhase,
      answeredCount: params.answeredCount,
      questionLimit: params.questionLimit ?? DEFAULT_QUESTIONS_PER_SESSION,
      weakSkills: params.weakSkills
    });
    logEvent(
      "ai.analyzer.fallback",
      {
        provider: "gemini",
        fallback_provider: "deterministic",
        answered_count: params.answeredCount,
        current_phase: params.currentPhase,
        suggested_phase: fallback.suggested_phase,
        reason: errorMessage(error)
      },
      "warn"
    );
    return fallback;
  }
}

export async function generateInterviewerQuestion(params: {
  prompt: string;
  mode: InterviewMode;
  phase: AgentPhase;
  targetRole: string;
  focusArea?: string | null;
  weakSkills: string[];
  resumeHighlights?: string[];
  latestAnswer?: string | null;
  followUpTargets?: string[];
  questionTypeHint?: QuestionCategory;
  answeredCount: number;
}) {
  const fallback = fallbackQuestion(params);
  const deterministicResult = (
    reason: "provider_unavailable" | "provider_error"
  ) => ({
    ...fallback,
    source: "deterministic" as QuestionGenerationSource,
    fallback_reason: reason
  });

  if (shouldUseOpenAI()) {
    try {
      const model = openAIModel(0.5);
      const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
      const content = textFromResponseContent(result.content as string | Array<{ text?: string }>);

      const generated = {
        question: content || fallback.question,
        questionType: params.questionTypeHint ?? fallback.questionType,
        source: "openai" as QuestionGenerationSource
      };
      logEvent("ai.question.generated", {
        provider: generated.source,
        phase: params.phase,
        answered_count: params.answeredCount,
        question_type: generated.questionType
      });
      return generated;
    } catch (error) {
      console.warn("OpenAI speaker failed, falling back to deterministic question generation.", error);
      const generated = deterministicResult("provider_error");
      logEvent(
        "ai.question.fallback",
        {
          provider: "openai",
          fallback_provider: generated.source,
          phase: params.phase,
          answered_count: params.answeredCount,
          question_type: generated.questionType,
          fallback_reason: generated.fallback_reason,
          reason: errorMessage(error)
        },
        "warn"
      );
      return generated;
    }
  }

  if (!shouldUseGemini()) {
    const generated = deterministicResult("provider_unavailable");
    logEvent("ai.question.generated", {
      provider: generated.source,
      phase: params.phase,
      answered_count: params.answeredCount,
      question_type: generated.questionType,
      fallback_reason: generated.fallback_reason
    });
    return generated;
  }

  try {
    return await runGeminiWithFallback({
      temperature: 0.5,
      invoke: async (model) => {
        const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
        const content =
          typeof result.content === "string"
            ? result.content.trim()
            : result.content
                .map((part) => ("text" in part ? part.text : ""))
                .join("")
                .trim();

        const generated = {
          question: content || fallback.question,
          questionType: params.questionTypeHint ?? fallback.questionType,
          source: "gemini" as QuestionGenerationSource
        };
        logEvent("ai.question.generated", {
          provider: generated.source,
          phase: params.phase,
          answered_count: params.answeredCount,
          question_type: generated.questionType
        });
        return generated;
      }
    });
  } catch (error) {
    console.warn("Gemini speaker failed, falling back to deterministic question generation.", error);
    const generated = deterministicResult("provider_error");
    logEvent(
      "ai.question.fallback",
      {
        provider: "gemini",
        fallback_provider: generated.source,
        phase: params.phase,
        answered_count: params.answeredCount,
        question_type: generated.questionType,
        fallback_reason: generated.fallback_reason,
        reason: errorMessage(error)
      },
      "warn"
    );
    return generated;
  }
}

export async function summarizeConversation(params: {
  prompt: string;
  fallbackSummary: string;
}) {
  if (shouldUseOpenAI()) {
    try {
      const model = openAIModel(0.2);
      const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
      const content = textFromResponseContent(result.content as string | Array<{ text?: string }>);

      return content || params.fallbackSummary;
    } catch (error) {
      console.warn("OpenAI summarizer failed, falling back to deterministic summary.", error);
      return params.fallbackSummary;
    }
  }

  if (!shouldUseGemini()) {
    return params.fallbackSummary;
  }

  try {
    return await runGeminiWithFallback({
      temperature: 0.2,
      invoke: async (model) => {
        const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
        const content =
          typeof result.content === "string"
            ? result.content.trim()
            : result.content
                .map((part) => ("text" in part ? part.text : ""))
                .join("")
                .trim();

        return content || params.fallbackSummary;
      }
    });
  } catch (error) {
    console.warn("Gemini summarizer failed, falling back to deterministic summary.", error);
    return params.fallbackSummary;
  }
}

export async function evaluateResponseWithProvider(params: {
  prompt: string;
  answerText: string;
  questionText: string;
  mode: InterviewMode;
  selfCritiqueEnabled: boolean;
  rubric: EvaluationRubric;
  targetRole: string;
}): Promise<RawEvaluationScorecard> {
  if (shouldUseOpenAI()) {
    try {
      const model = openAIModel(0.2).withStructuredOutput(evaluationGeminiSchema, {
        name: "InterviewEvaluation"
      });
      const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
      return normalizeGeminiEvaluationOutput(
        evaluationGeminiSchema.parse(result),
        params.selfCritiqueEnabled
      );
    } catch (error) {
      console.warn("OpenAI evaluator failed, falling back to deterministic evaluation.", error);
      return deterministicEvaluation(params);
    }
  }

  if (!shouldUseGemini()) {
    return deterministicEvaluation(params);
  }

  try {
    return await runGeminiWithFallback({
      temperature: 0.2,
      invoke: async (baseModel) => {
        const model = baseModel.withStructuredOutput(evaluationGeminiSchema, {
          name: "InterviewEvaluation",
          method: "jsonSchema"
        });
        const result = await model.invoke(params.prompt, { signal: aiAbortSignal() });
        return normalizeGeminiEvaluationOutput(
          evaluationGeminiSchema.parse(result),
          params.selfCritiqueEnabled
        );
      }
    });
  } catch (error) {
    console.warn("Gemini evaluator failed, falling back to deterministic evaluation.", error);
    return deterministicEvaluation(params);
  }
}

export function describeProviderMode() {
  if (shouldUseOpenAI()) {
    return "openai";
  }

  if (shouldUseGemini()) {
    return "gemini";
  }

  return "deterministic";
}
