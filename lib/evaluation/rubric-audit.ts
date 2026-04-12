import type {
  EvaluationDimensionId,
  EvaluationDimensionScoreMap,
  EvaluationRubric,
  RawEvaluationScorecard,
  RubricCoverageAudit,
  Scorecard,
  StarField
} from "@/lib/types";

function meaningfulStarContent(content: string) {
  const normalized = content.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return ![
    "not clearly stated",
    "implied rather than explicitly named",
    "could be more specific",
    "needs a clearer outcome",
    "not clearly covered",
    "missing"
  ].some((phrase) => normalized.includes(phrase));
}

export function createDimensionScoreMap(scorecard: RawEvaluationScorecard): EvaluationDimensionScoreMap {
  return {
    clarity: scorecard.clarity_score,
    structure: scorecard.structure_score,
    relevance: scorecard.relevance_score,
    soft_skills: scorecard.soft_skills_score
  };
}

function scoreForDimension(
  scores: EvaluationDimensionScoreMap,
  dimensionId: EvaluationDimensionId
) {
  return scores[dimensionId];
}

export function deriveRubricInsights(params: {
  rubric: EvaluationRubric;
  dimension_scores: EvaluationDimensionScoreMap;
}) {
  const orderedDimensions = params.rubric.dimensions
    .map((dimension) => ({
      ...dimension,
      score: scoreForDimension(params.dimension_scores, dimension.id)
    }))
    .sort((left, right) => left.feedback_priority - right.feedback_priority);

  const weak_skills = orderedDimensions
    .filter(
      (dimension) =>
        dimension.score <=
          (dimension.weak_threshold ?? params.rubric.weak_skill_threshold) &&
        dimension.weak_skill_label
    )
    .map((dimension) => dimension.weak_skill_label as string);

  const strengths = orderedDimensions
    .filter(
      (dimension) =>
        dimension.score >=
          (dimension.strength_threshold ?? params.rubric.strength_skill_threshold) &&
        dimension.strength_skill_label
    )
    .map((dimension) => dimension.strength_skill_label as string);

  return {
    weak_skills: Array.from(new Set(weak_skills)),
    strengths: Array.from(new Set(strengths))
  };
}

function feedbackMentionsDimension(params: {
  dimensionLabel: string;
  skillLabel?: string | null;
  feedbackCorpus: string;
}) {
  const keywords = [params.dimensionLabel, params.skillLabel]
    .filter(Boolean)
    .flatMap((value) =>
      String(value)
        .toLowerCase()
        .split(/[\s/_-]+/)
        .filter((token) => token.length > 3)
    );

  if (!keywords.length) {
    return false;
  }

  return keywords.some((keyword) => params.feedbackCorpus.includes(keyword));
}

export function buildRubricCoverageAudit(params: {
  rubric: EvaluationRubric;
  scorecard: RawEvaluationScorecard;
  dimension_scores?: EvaluationDimensionScoreMap;
}): RubricCoverageAudit {
  const dimensionScores = params.dimension_scores ?? createDimensionScoreMap(params.scorecard);
  const required_dimensions_checked = params.rubric.dimensions
    .filter((dimension) => Number.isFinite(scoreForDimension(dimensionScores, dimension.id)))
    .map((dimension) => dimension.id);
  const missing_dimensions = params.rubric.dimensions
    .filter((dimension) => !required_dimensions_checked.includes(dimension.id))
    .map((dimension) => dimension.id);

  const star_fields_checked = params.rubric.star_fields.filter((field) =>
    meaningfulStarContent(params.scorecard.star[field])
  );
  const missing_star_fields = params.rubric.star_fields.filter(
    (field) => !star_fields_checked.includes(field)
  );

  const feedbackCorpus = [
    ...params.scorecard.actionable_feedback,
    ...params.scorecard.growth_tips,
    params.scorecard.self_critique_output ?? ""
  ]
    .join(" ")
    .toLowerCase();

  const uncovered_feedback_areas = params.rubric.dimensions
    .filter((dimension) => {
      const score = scoreForDimension(dimensionScores, dimension.id);
      const threshold = dimension.weak_threshold ?? params.rubric.weak_skill_threshold;
      return score <= threshold;
    })
    .filter(
      (dimension) =>
        !feedbackMentionsDimension({
          dimensionLabel: dimension.label,
          skillLabel: dimension.weak_skill_label,
          feedbackCorpus
        })
    )
    .map((dimension) => dimension.id);

  const checksTotal =
    params.rubric.dimensions.length +
    params.rubric.star_fields.length +
    uncovered_feedback_areas.length +
    missing_dimensions.length;
  const checksPassed =
    required_dimensions_checked.length +
    star_fields_checked.length +
    params.rubric.dimensions.filter((dimension) => {
      const score = scoreForDimension(dimensionScores, dimension.id);
      const threshold = dimension.weak_threshold ?? params.rubric.weak_skill_threshold;
      return score > threshold;
    }).length;

  return {
    required_dimensions_checked,
    missing_dimensions,
    star_fields_checked,
    missing_star_fields,
    uncovered_feedback_areas,
    completeness_score:
      checksTotal === 0 ? 100 : Math.max(0, Math.min(100, Math.round((checksPassed / checksTotal) * 100)))
  };
}

export function enrichScorecardWithRubric(params: {
  rubric: EvaluationRubric;
  rubric_match_type: Scorecard["rubric_match_type"];
  scorecard: RawEvaluationScorecard;
}): Scorecard {
  const dimension_scores = createDimensionScoreMap(params.scorecard);
  const insights = deriveRubricInsights({
    rubric: params.rubric,
    dimension_scores
  });
  const rubric_coverage = buildRubricCoverageAudit({
    rubric: params.rubric,
    scorecard: params.scorecard,
    dimension_scores
  });
  const values = Object.values(dimension_scores);
  const overall_score = Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  );

  return {
    ...params.scorecard,
    rubric_id: params.rubric.rubric_id,
    rubric_match_type: params.rubric_match_type,
    overall_score,
    dimension_scores,
    strengths: insights.strengths,
    weak_skills: insights.weak_skills,
    rubric_coverage
  };
}
