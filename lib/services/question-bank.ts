import type { InterviewMode } from "@/lib/types";

export interface QuestionTemplate {
  id: string;
  mode: InterviewMode;
  category: "primary" | "follow_up" | "situational" | "clarifying";
  focus: string;
  template: string;
}

export const QUESTION_BANK: QuestionTemplate[] = [
  {
    id: "beh-1",
    mode: "behavioral",
    category: "primary",
    focus: "leadership",
    template:
      "Tell me about a time you influenced a decision without formal authority while pursuing a {targetRole} goal."
  },
  {
    id: "beh-2",
    mode: "behavioral",
    category: "primary",
    focus: "ownership",
    template:
      "Describe a moment when something important started slipping and you had to regain momentum."
  },
  {
    id: "beh-3",
    mode: "behavioral",
    category: "primary",
    focus: "stakeholder management",
    template:
      "Walk me through a time you had to align stakeholders who wanted different outcomes."
  },
  {
    id: "beh-4",
    mode: "behavioral",
    category: "primary",
    focus: "ambiguity",
    template:
      "Tell me about a time you had to move forward when the path or requirements were still ambiguous."
  },
  {
    id: "beh-5",
    mode: "behavioral",
    category: "primary",
    focus: "resume experience",
    template:
      "Looking at your work on {resumeHighlight}, tell me about a time you had to make a difficult tradeoff or prioritization call."
  },
  {
    id: "beh-6",
    mode: "behavioral",
    category: "primary",
    focus: "feedback",
    template:
      "Describe a time you received tough feedback and changed your approach because of it."
  },
  {
    id: "beh-7",
    mode: "behavioral",
    category: "situational",
    focus: "conflict",
    template:
      "Imagine a teammate disagrees with your plan right before a deadline. How would you respond and keep the outcome strong?"
  },
  {
    id: "beh-8",
    mode: "behavioral",
    category: "situational",
    focus: "prioritization",
    template:
      "You have two high-value requests and only enough time to execute one well. How would you decide and communicate the tradeoff?"
  },
  {
    id: "beh-9",
    mode: "behavioral",
    category: "situational",
    focus: "ownership",
    template:
      "If you realized late in the process that a decision you made was hurting the outcome, how would you recover?"
  },
  {
    id: "tech-1",
    mode: "technical",
    category: "primary",
    focus: "architecture",
    template:
      "Design a small but reliable system that a {targetRole} candidate might reasonably discuss in an interview. Start with requirements and tradeoffs."
  },
  {
    id: "tech-2",
    mode: "technical",
    category: "situational",
    focus: "debugging",
    template:
      "You ship a feature and latency doubles for one user segment. How would you investigate and stabilize it?"
  },
  {
    id: "tech-3",
    mode: "technical",
    category: "follow_up",
    focus: "tradeoffs",
    template:
      "What assumption in your design feels most fragile, and what tradeoff did you accept anyway?"
  },
  {
    id: "case-1",
    mode: "case",
    category: "primary",
    focus: "market sizing",
    template:
      "A university career center wants to raise student interview completion rates. How would you frame the problem and prioritize first steps?"
  },
  {
    id: "case-2",
    mode: "case",
    category: "situational",
    focus: "prioritization",
    template:
      "Assume adoption is flat after launch. Walk me through how you would diagnose the problem and choose one intervention."
  },
  {
    id: "case-3",
    mode: "case",
    category: "follow_up",
    focus: "synthesis",
    template:
      "Summarize your recommendation in under a minute for an executive who only cares about student outcomes and risk."
  }
];

export function renderQuestionTemplate(
  template: string,
  values: {
    targetRole: string;
    focusArea?: string | null;
    weakness?: string | null;
    resumeHighlight?: string | null;
  }
) {
  return template
    .replaceAll("{targetRole}", values.targetRole)
    .replaceAll("{focusArea}", values.focusArea ?? "growth")
    .replaceAll("{weakness}", values.weakness ?? "communication")
    .replaceAll("{resumeHighlight}", values.resumeHighlight ?? values.focusArea ?? "a recent project");
}
