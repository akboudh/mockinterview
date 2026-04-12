import { readFileSync } from "fs";
import path from "path";

import YAML from "yaml";
import { z } from "zod";

import type {
  EvaluationDimensionId,
  EvaluationRubric,
  EvaluationRubricDimension,
  EvaluationRubricLibrary,
  InterviewMode,
  StarField
} from "@/lib/types";

const DIMENSION_IDS = ["clarity", "structure", "relevance", "soft_skills"] as const;
const STAR_FIELDS = ["situation", "task", "action", "result"] as const;

const criterionSchema = z.object({
  label: z.string().optional(),
  scale: z.union([z.string(), z.number()]),
  evaluator_prompt: z.string(),
  feedback_priority: z.number().int().positive().optional(),
  weak_skill_label: z.string().optional(),
  strength_skill_label: z.string().optional(),
  weak_threshold: z.number().min(1).max(5).optional(),
  strength_threshold: z.number().min(1).max(5).optional()
});

const rubricSourceSchema = z.object({
  rubric_id: z.string().optional(),
  description: z.string(),
  role_context: z.array(z.string()).default([]),
  criteria: z.object({
    clarity: criterionSchema,
    structure: criterionSchema,
    relevance: criterionSchema,
    soft_skills: criterionSchema
  }),
  star_fields: z.array(z.enum(STAR_FIELDS)).default([...STAR_FIELDS]),
  feedback_priorities: z.array(z.enum(DIMENSION_IDS)).optional(),
  weak_skill_threshold: z.number().min(1).max(5).optional(),
  strength_skill_threshold: z.number().min(1).max(5).optional()
});

const rubricLibrarySourceSchema = z.object({
  version: z.number().int().positive().default(1),
  global_default: rubricSourceSchema.optional(),
  library: z.object({
    behavioral: rubricSourceSchema.optional(),
    technical: rubricSourceSchema.optional(),
    case: rubricSourceSchema.optional()
  })
});

type RubricSource = z.infer<typeof rubricSourceSchema>;
type RubricLibrarySource = z.infer<typeof rubricLibrarySourceSchema>;

const DEFAULT_LABELS: Record<EvaluationDimensionId, string> = {
  clarity: "Clarity",
  structure: "Structure",
  relevance: "Relevance",
  soft_skills: "Soft skills"
};

const DEFAULT_WEAK_SKILLS: Record<
  InterviewMode | "global",
  Record<EvaluationDimensionId, string>
> = {
  global: {
    clarity: "clear communication",
    structure: "story structure",
    relevance: "answer relevance",
    soft_skills: "collaborative communication"
  },
  behavioral: {
    clarity: "clear communication",
    structure: "story structure",
    relevance: "role alignment",
    soft_skills: "collaborative communication"
  },
  technical: {
    clarity: "technical communication",
    structure: "solution structure",
    relevance: "tradeoff articulation",
    soft_skills: "collaborative communication"
  },
  case: {
    clarity: "executive communication",
    structure: "problem framing",
    relevance: "recommendation alignment",
    soft_skills: "stakeholder communication"
  }
};

const DEFAULT_STRENGTHS: Record<
  InterviewMode | "global",
  Record<EvaluationDimensionId, string>
> = {
  global: {
    clarity: "clear communication",
    structure: "structured thinking",
    relevance: "focused answers",
    soft_skills: "collaborative communication"
  },
  behavioral: {
    clarity: "clear communication",
    structure: "structured storytelling",
    relevance: "role-aligned examples",
    soft_skills: "collaborative communication"
  },
  technical: {
    clarity: "technical clarity",
    structure: "systematic reasoning",
    relevance: "tradeoff communication",
    soft_skills: "collaborative communication"
  },
  case: {
    clarity: "executive clarity",
    structure: "structured problem solving",
    relevance: "goal-focused synthesis",
    soft_skills: "stakeholder communication"
  }
};

function rubricFilePath() {
  return path.join(process.cwd(), "rubrics", "interview-rubrics.yaml");
}

function parseScale(scale: string | number) {
  if (typeof scale === "number") {
    return { min: 1, max: scale };
  }

  const match = scale.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    return {
      min: Number(match[1]),
      max: Number(match[2])
    };
  }

  const numeric = Number(scale);
  if (Number.isFinite(numeric)) {
    return { min: 1, max: numeric };
  }

  return { min: 1, max: 5 };
}

function normalizeDimension(
  mode: InterviewMode | "global",
  id: EvaluationDimensionId,
  source: z.infer<typeof criterionSchema>,
  priorityIndex: number
): EvaluationRubricDimension {
  const scale = parseScale(source.scale);

  return {
    id,
    label: source.label ?? DEFAULT_LABELS[id],
    scale_min: scale.min,
    scale_max: scale.max,
    evaluator_prompt: source.evaluator_prompt,
    feedback_priority: source.feedback_priority ?? priorityIndex + 1,
    weak_skill_label: source.weak_skill_label ?? DEFAULT_WEAK_SKILLS[mode][id],
    strength_skill_label: source.strength_skill_label ?? DEFAULT_STRENGTHS[mode][id],
    weak_threshold: source.weak_threshold ?? null,
    strength_threshold: source.strength_threshold ?? null
  };
}

function normalizeRubric(params: {
  source: RubricSource;
  mode: InterviewMode | "global";
  version: number;
}): EvaluationRubric {
  const priorityOrder = params.source.feedback_priorities ?? [...DIMENSION_IDS];
  const dimensions = DIMENSION_IDS.map((id) =>
    normalizeDimension(
      params.mode,
      id,
      params.source.criteria[id],
      Math.max(priorityOrder.indexOf(id), 0)
    )
  ).sort((left, right) => left.feedback_priority - right.feedback_priority);

  return {
    rubric_id: params.source.rubric_id ?? `${params.mode}.default`,
    version: params.version,
    mode: params.mode,
    description: params.source.description,
    role_context: params.source.role_context,
    dimensions,
    star_fields: params.source.star_fields,
    feedback_priorities: priorityOrder,
    weak_skill_threshold: params.source.weak_skill_threshold ?? 3,
    strength_skill_threshold: params.source.strength_skill_threshold ?? 4
  };
}

function fallbackGlobalRubric(version: number): EvaluationRubric {
  return normalizeRubric({
    version,
    mode: "global",
    source: {
      rubric_id: "global.default",
      description: "Fallback interview rubric for clear, structured, relevant, and supportive answers.",
      role_context: [],
      criteria: {
        clarity: {
          scale: "1-5",
          evaluator_prompt: "Assess whether the answer is easy to follow and concise."
        },
        structure: {
          scale: "1-5",
          evaluator_prompt: "Assess whether the answer has a clear flow and explicit reasoning."
        },
        relevance: {
          scale: "1-5",
          evaluator_prompt: "Assess whether the answer addresses the interview question directly."
        },
        soft_skills: {
          scale: "1-5",
          evaluator_prompt: "Assess collaboration, empathy, ownership, and communication quality."
        }
      },
      star_fields: [...STAR_FIELDS],
      feedback_priorities: ["structure", "relevance", "clarity", "soft_skills"],
      weak_skill_threshold: 3,
      strength_skill_threshold: 4
    }
  });
}

export function normalizeRubricLibrary(raw: unknown): EvaluationRubricLibrary {
  const parsed = rubricLibrarySourceSchema.parse(raw) as RubricLibrarySource;
  const globalDefault = parsed.global_default
    ? normalizeRubric({
        source: parsed.global_default,
        mode: "global",
        version: parsed.version
      })
    : fallbackGlobalRubric(parsed.version);

  return {
    version: parsed.version,
    global_default: globalDefault,
    by_mode: {
      behavioral: parsed.library.behavioral
        ? normalizeRubric({
            source: parsed.library.behavioral,
            mode: "behavioral",
            version: parsed.version
          })
        : undefined,
      technical: parsed.library.technical
        ? normalizeRubric({
            source: parsed.library.technical,
            mode: "technical",
            version: parsed.version
          })
        : undefined,
      case: parsed.library.case
        ? normalizeRubric({
            source: parsed.library.case,
            mode: "case",
            version: parsed.version
          })
        : undefined
    }
  };
}

let cachedLibrary: EvaluationRubricLibrary | null = null;

export async function loadEvaluationRubricLibrary() {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  const raw = readFileSync(rubricFilePath(), "utf-8");
  cachedLibrary = normalizeRubricLibrary(YAML.parse(raw));
  return cachedLibrary;
}

export function clearEvaluationRubricCache() {
  cachedLibrary = null;
}
