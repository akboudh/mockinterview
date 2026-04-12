import { updateDb } from "@/lib/db";
import { evaluateResponseWithProvider } from "@/lib/ai/provider";
import { recordSkillSignal, saveEvent } from "@/lib/services/memory-service";
import { enrichScorecardWithRubric } from "@/lib/evaluation/rubric-audit";
import { loadEvaluationRubricLibrary } from "@/lib/evaluation/rubric-loader";
import { selectEvaluationRubric } from "@/lib/evaluation/rubric-selector";
import type {
  EvaluationRecord,
  InterviewMode,
  RawEvaluationScorecard,
  Scorecard
} from "@/lib/types";

function buildEvaluationPrompt(params: {
  questionText: string;
  answerText: string;
  targetRole: string;
  mode: InterviewMode;
  selfCritiqueEnabled: boolean;
  rubricId: string;
  rubricDescription: string;
  rubricMatchType: string;
  dimensionInstructions: string[];
  starFields: string[];
  feedbackPriorities: string[];
}) {
  return [
    "You are evaluating a mock interview answer.",
    "Return a structured rubric evaluation only.",
    `Mode: ${params.mode}`,
    `Target role: ${params.targetRole}`,
    `Rubric id: ${params.rubricId}`,
    `Rubric match type: ${params.rubricMatchType}`,
    `Rubric description: ${params.rubricDescription}`,
    `Required STAR fields: ${params.starFields.join(", ")}`,
    `Feedback priorities: ${params.feedbackPriorities.join(", ")}`,
    `Self critique enabled: ${params.selfCritiqueEnabled ? "yes" : "no"}`,
    "Rubric dimensions:",
    ...params.dimensionInstructions.map((instruction) => `- ${instruction}`),
    `Question: ${params.questionText}`,
    `Answer: ${params.answerText}`,
    "Score for clarity, structure, relevance, and soft skills on a 1-5 scale.",
    "Use the rubric description and dimension instructions directly when scoring and writing feedback.",
    "Also produce STAR breakdown, overall summary, actionable feedback, growth tips, and optional evaluator self-critique."
  ].join("\n");
}

function buildRubricDimensionInstructions(scorecardRubric: Awaited<
  ReturnType<typeof loadEvaluationRubricLibrary>
>["global_default"]) {
  return scorecardRubric.dimensions.map(
    (dimension) =>
      `${dimension.label} (${dimension.id}) on ${dimension.scale_min}-${dimension.scale_max}: ${dimension.evaluator_prompt}`
  );
}

function plannedSkillSignals(params: {
  user_id: string;
  session_id: string;
  evaluation_id: string;
  scorecard: Scorecard;
  question_text: string;
  target_role: string;
}) {
  const weaknessPlans = params.scorecard.weak_skills.slice(0, 2).map((skill_name) => ({
    user_id: params.user_id,
    skill_name,
    signal_type: "weakness" as const,
    source_session_id: params.session_id,
    source_evaluation_id: params.evaluation_id,
    notes: `Rubric ${params.scorecard.rubric_id} flagged ${skill_name} as a coaching area for "${params.question_text}".`
  }));
  const strengthPlans = params.scorecard.strengths.slice(0, 1).map((skill_name) => ({
    user_id: params.user_id,
    skill_name,
    signal_type: "strength" as const,
    source_session_id: params.session_id,
    source_evaluation_id: params.evaluation_id,
    notes: `Rubric ${params.scorecard.rubric_id} identified ${skill_name} as a repeatable strength for ${params.target_role}.`
  }));

  return [...weaknessPlans, ...strengthPlans];
}

export interface EvaluateResponseDeps {
  updateDb: typeof updateDb;
  evaluateWithProvider: typeof evaluateResponseWithProvider;
  saveEvent: typeof saveEvent;
  recordSkillSignal: typeof recordSkillSignal;
  loadRubricLibrary: typeof loadEvaluationRubricLibrary;
  selectRubric: typeof selectEvaluationRubric;
  now: () => string;
  randomUUID: () => string;
}

export interface EvaluateResponseParams {
  session_id: string;
  user_id: string;
  question_message_id: string;
  answer_message_id: string;
  question_text: string;
  answer_text: string;
  target_role: string;
  mode: InterviewMode;
  self_critique_enabled: boolean;
}

export interface ComputedEvaluationResult {
  record: EvaluationRecord;
  scorecard: Scorecard;
  memoryEventContent: Record<string, unknown>;
  plannedSignals: Array<Parameters<typeof recordSkillSignal>[0]>;
}

function withEvaluationDeps(deps: Partial<EvaluateResponseDeps> = {}): EvaluateResponseDeps {
  return {
    updateDb,
    evaluateWithProvider: evaluateResponseWithProvider,
    saveEvent,
    recordSkillSignal,
    loadRubricLibrary: loadEvaluationRubricLibrary,
    selectRubric: selectEvaluationRubric,
    now: () => new Date().toISOString(),
    randomUUID: () => crypto.randomUUID(),
    ...deps
  };
}

export async function computeEvaluationResult(
  params: EvaluateResponseParams,
  deps: Partial<EvaluateResponseDeps> = {}
): Promise<ComputedEvaluationResult> {
  const resolvedDeps = withEvaluationDeps(deps);
  const rubricLibrary = await resolvedDeps.loadRubricLibrary();
  const selectedRubric = resolvedDeps.selectRubric({
    library: rubricLibrary,
    mode: params.mode,
    target_role: params.target_role
  });
  const baseScorecard: RawEvaluationScorecard = await resolvedDeps.evaluateWithProvider({
    prompt: buildEvaluationPrompt({
      questionText: params.question_text,
      answerText: params.answer_text,
      targetRole: params.target_role,
      mode: params.mode,
      selfCritiqueEnabled: params.self_critique_enabled,
      rubricId: selectedRubric.rubric.rubric_id,
      rubricDescription: selectedRubric.rubric.description,
      rubricMatchType: selectedRubric.match_type,
      dimensionInstructions: buildRubricDimensionInstructions(selectedRubric.rubric),
      starFields: selectedRubric.rubric.star_fields,
      feedbackPriorities: selectedRubric.rubric.feedback_priorities
    }),
    answerText: params.answer_text,
    questionText: params.question_text,
    mode: params.mode,
    selfCritiqueEnabled: params.self_critique_enabled,
    rubric: selectedRubric.rubric,
    targetRole: params.target_role
  });
  const scorecard = enrichScorecardWithRubric({
    rubric: selectedRubric.rubric,
    rubric_match_type: selectedRubric.match_type,
    scorecard: baseScorecard
  });
  const evaluationId = resolvedDeps.randomUUID();
  const createdAt = resolvedDeps.now();

  const record: EvaluationRecord = {
    evaluation_id: evaluationId,
    session_id: params.session_id,
    question_message_id: params.question_message_id,
    answer_message_id: params.answer_message_id,
    target_role: params.target_role,
    mode: params.mode,
    clarity_score: scorecard.clarity_score,
    structure_score: scorecard.structure_score,
    relevance_score: scorecard.relevance_score,
    soft_skills_score: scorecard.soft_skills_score,
    star_situation: scorecard.star.situation,
    star_task: scorecard.star.task,
    star_action: scorecard.star.action,
    star_result: scorecard.star.result,
    overall_summary: scorecard.overall_summary,
    actionable_feedback: scorecard.actionable_feedback,
    growth_tips: scorecard.growth_tips,
    self_critique_output: scorecard.self_critique_output,
    rubric_id: scorecard.rubric_id,
    rubric_match_type: scorecard.rubric_match_type,
    overall_score: scorecard.overall_score,
    strengths: scorecard.strengths,
    weak_skills: scorecard.weak_skills,
    rubric_coverage: scorecard.rubric_coverage,
    created_at: createdAt
  };

  return {
    record,
    scorecard,
    memoryEventContent: {
      evaluation_id: record.evaluation_id,
      summary: record.overall_summary,
      target_role: params.target_role,
      rubric_id: scorecard.rubric_id,
      overall_score: scorecard.overall_score,
      scores: {
        clarity: record.clarity_score,
        structure: record.structure_score,
        relevance: record.relevance_score,
        soft_skills: record.soft_skills_score
      },
      strengths: scorecard.strengths,
      weak_skills: scorecard.weak_skills,
      rubric_coverage: scorecard.rubric_coverage
    },
    plannedSignals: plannedSkillSignals({
      user_id: params.user_id,
      session_id: params.session_id,
      evaluation_id: evaluationId,
      scorecard,
      question_text: params.question_text,
      target_role: params.target_role
    })
  };
}

export async function persistEvaluationResult(
  params: EvaluateResponseParams,
  computed: ComputedEvaluationResult,
  deps: Partial<EvaluateResponseDeps> = {}
) {
  const resolvedDeps = withEvaluationDeps(deps);

  await resolvedDeps.updateDb((db) => ({
    ...db,
    evaluations: [...db.evaluations, computed.record],
    agentSessionStates: db.agentSessionStates.map((state) =>
      state.session_id === params.session_id
        ? {
            ...state,
            state_json: {
              ...state.state_json,
              latest_evaluation: {
                clarity_score: computed.record.clarity_score,
                structure_score: computed.record.structure_score,
                relevance_score: computed.record.relevance_score,
                soft_skills_score: computed.record.soft_skills_score,
                overall_summary: computed.record.overall_summary,
                rubric_id: computed.record.rubric_id ?? null,
                overall_score: computed.record.overall_score ?? null
              }
            },
            updated_at: resolvedDeps.now()
          }
        : state
    )
  }));

  await resolvedDeps.saveEvent({
    session_id: params.session_id,
    user_id: params.user_id,
    memory_tier: "episodic",
    event_type: "evaluation_record",
    content: computed.memoryEventContent
  });

  for (const signal of computed.plannedSignals) {
    await resolvedDeps.recordSkillSignal(signal);
  }
}

export async function evaluateResponse(
  params: EvaluateResponseParams,
  deps: Partial<EvaluateResponseDeps> = {}
) {
  const computed = await computeEvaluationResult(params, deps);
  await persistEvaluationResult(params, computed, deps);

  return {
    evaluation_id: computed.record.evaluation_id,
    scorecard: computed.scorecard satisfies Scorecard
  };
}
