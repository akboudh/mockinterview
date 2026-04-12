import { evaluateResponseWithProvider } from "@/lib/ai/provider";
import { buildRubricCoverageAudit } from "@/lib/evaluation/rubric-audit";
import {
  clearEvaluationRubricCache,
  loadEvaluationRubricLibrary,
  normalizeRubricLibrary
} from "@/lib/evaluation/rubric-loader";
import { selectEvaluationRubric } from "@/lib/evaluation/rubric-selector";

const originalEnv = {
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY
};

describe("evaluation rubric runtime", () => {
  beforeEach(() => {
    clearEvaluationRubricCache();
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    process.env.LLM_PROVIDER = "deterministic";
  });

  afterEach(() => {
    clearEvaluationRubricCache();
    process.env.LLM_PROVIDER = originalEnv.LLM_PROVIDER;
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.GOOGLE_API_KEY = originalEnv.GOOGLE_API_KEY;
  });

  it("normalizes the YAML rubric library into a runtime contract", async () => {
    const library = await loadEvaluationRubricLibrary();

    expect(library.version).toBeGreaterThan(0);
    expect(library.by_mode.technical?.rubric_id).toBe("technical.default");
    expect(library.by_mode.behavioral?.dimensions.map((dimension) => dimension.id)).toEqual([
      "structure",
      "relevance",
      "clarity",
      "soft_skills"
    ]);
    expect(library.global_default.rubric_id).toBe("global.default");
  });

  it("selects exact, mode-default, and global-default rubrics deterministically", async () => {
    const liveLibrary = await loadEvaluationRubricLibrary();
    const exact = selectEvaluationRubric({
      library: liveLibrary,
      mode: "behavioral",
      target_role: "Product Manager Intern"
    });
    const modeDefault = selectEvaluationRubric({
      library: liveLibrary,
      mode: "behavioral",
      target_role: "Unknown Intern Role"
    });
    const customLibrary = normalizeRubricLibrary({
      version: 1,
      global_default: {
        description: "Fallback rubric",
        role_context: [],
        criteria: {
          clarity: {
            scale: "1-5",
            evaluator_prompt: "Assess clarity."
          },
          structure: {
            scale: "1-5",
            evaluator_prompt: "Assess structure."
          },
          relevance: {
            scale: "1-5",
            evaluator_prompt: "Assess relevance."
          },
          soft_skills: {
            scale: "1-5",
            evaluator_prompt: "Assess soft skills."
          }
        },
        star_fields: ["situation", "task", "action", "result"]
      },
      library: {
        behavioral: {
          description: "Behavioral rubric",
          role_context: ["Product Manager Intern"],
          criteria: {
            clarity: {
              scale: "1-5",
              evaluator_prompt: "Assess clarity."
            },
            structure: {
              scale: "1-5",
              evaluator_prompt: "Assess structure."
            },
            relevance: {
              scale: "1-5",
              evaluator_prompt: "Assess relevance."
            },
            soft_skills: {
              scale: "1-5",
              evaluator_prompt: "Assess soft skills."
            }
          },
          star_fields: ["situation", "task", "action", "result"]
        }
      }
    });
    const globalDefault = selectEvaluationRubric({
      library: customLibrary,
      mode: "case",
      target_role: "Consulting Candidate"
    });

    expect(exact.match_type).toBe("exact_role_mode");
    expect(modeDefault.match_type).toBe("mode_default");
    expect(globalDefault.match_type).toBe("global_default");
    expect(globalDefault.rubric.rubric_id).toBe("global.default");
  });

  it("changes deterministic evaluation behavior when rubric definitions change", async () => {
    const strictLibrary = normalizeRubricLibrary({
      version: 1,
      library: {
        behavioral: {
          rubric_id: "behavioral.strict",
          description: "Strict STAR rubric",
          role_context: ["Product Manager Intern"],
          feedback_priorities: ["structure", "relevance", "clarity", "soft_skills"],
          criteria: {
            clarity: {
              scale: "1-5",
              evaluator_prompt: "Assess clarity."
            },
            structure: {
              scale: "1-5",
              evaluator_prompt: "Assess whether Situation, Task, Action, and Result are all explicit."
            },
            relevance: {
              scale: "1-5",
              evaluator_prompt: "Assess relevance."
            },
            soft_skills: {
              scale: "1-5",
              evaluator_prompt: "Assess soft skills."
            }
          },
          star_fields: ["situation", "task", "action", "result"]
        }
      }
    });
    const lenientLibrary = normalizeRubricLibrary({
      version: 1,
      library: {
        behavioral: {
          rubric_id: "behavioral.lenient",
          description: "Lenient storytelling rubric",
          role_context: ["Product Manager Intern"],
          feedback_priorities: ["clarity", "relevance", "structure", "soft_skills"],
          criteria: {
            clarity: {
              scale: "1-5",
              evaluator_prompt: "Assess clarity."
            },
            structure: {
              scale: "1-5",
              evaluator_prompt: "Assess whether the answer is generally sequenced well."
            },
            relevance: {
              scale: "1-5",
              evaluator_prompt: "Assess relevance."
            },
            soft_skills: {
              scale: "1-5",
              evaluator_prompt: "Assess soft skills."
            }
          },
          star_fields: ["action"]
        }
      }
    });

    const answerText =
      "Action: I reset owners, clarified dependencies, and communicated the plan to stakeholders.";
    const strict = await evaluateResponseWithProvider({
      prompt: "Evaluate the answer.",
      answerText,
      questionText: "Tell me about a leadership moment.",
      mode: "behavioral",
      selfCritiqueEnabled: true,
      rubric: strictLibrary.by_mode.behavioral!,
      targetRole: "Product Manager Intern"
    });
    const lenient = await evaluateResponseWithProvider({
      prompt: "Evaluate the answer.",
      answerText,
      questionText: "Tell me about a leadership moment.",
      mode: "behavioral",
      selfCritiqueEnabled: true,
      rubric: lenientLibrary.by_mode.behavioral!,
      targetRole: "Product Manager Intern"
    });

    expect(strict.structure_score).toBeLessThan(lenient.structure_score);
    expect(strict.actionable_feedback.join(" ").toLowerCase()).toMatch(
      /situation|task|result|missing/
    );
  });

  it("builds a structured rubric coverage audit from the selected rubric", async () => {
    const library = normalizeRubricLibrary({
      version: 1,
      library: {
        behavioral: {
          rubric_id: "behavioral.audit",
          description: "Audit rubric",
          role_context: ["Product Manager Intern"],
          criteria: {
            clarity: {
              scale: "1-5",
              evaluator_prompt: "Assess clarity."
            },
            structure: {
              scale: "1-5",
              evaluator_prompt: "Assess structure."
            },
            relevance: {
              scale: "1-5",
              evaluator_prompt: "Assess relevance."
            },
            soft_skills: {
              scale: "1-5",
              evaluator_prompt: "Assess soft skills."
            }
          },
          star_fields: ["situation", "task", "action", "result"]
        }
      }
    });

    const scorecard = await evaluateResponseWithProvider({
      prompt: "Evaluate the answer.",
      answerText:
        "Situation: the launch slipped. Task: I needed to recover the timeline. Action: I reset priorities and communicated tradeoffs.",
      questionText: "Tell me about a leadership moment.",
      mode: "behavioral",
      selfCritiqueEnabled: true,
      rubric: library.by_mode.behavioral!,
      targetRole: "Product Manager Intern"
    });

    const audit = buildRubricCoverageAudit({
      rubric: library.by_mode.behavioral!,
      scorecard
    });

    expect(audit.required_dimensions_checked).toContain("structure");
    expect(audit.missing_star_fields).toContain("result");
    expect(audit.completeness_score).toBeLessThan(100);
  });
});
