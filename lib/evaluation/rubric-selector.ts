import type {
  EvaluationRubricLibrary,
  InterviewMode,
  SelectedEvaluationRubric
} from "@/lib/types";

function normalizeRole(role: string) {
  return role.trim().toLowerCase().replace(/\s+/g, " ");
}

export function selectEvaluationRubric(params: {
  library: EvaluationRubricLibrary;
  mode: InterviewMode;
  target_role: string;
}): SelectedEvaluationRubric {
  const modeRubric = params.library.by_mode[params.mode];

  if (!modeRubric) {
    return {
      rubric: params.library.global_default,
      match_type: "global_default",
      requested_role: params.target_role,
      matched_role: null
    };
  }

  const requestedRole = normalizeRole(params.target_role);
  const matchedRole =
    modeRubric.role_context.find((role) => normalizeRole(role) === requestedRole) ?? null;

  return {
    rubric: modeRubric,
    match_type: matchedRole ? "exact_role_mode" : "mode_default",
    requested_role: params.target_role,
    matched_role: matchedRole
  };
}
