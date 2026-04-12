export const DEMO_USER_ID = "demo-student";
export const MAX_QUESTIONS_PER_SESSION = 5;
export const DB_PATH = "data/mock-db.json";
export const SQLITE_DB_PATH = "data/mockinterview.sqlite";

export const INTERVIEW_MODES = [
  {
    value: "behavioral",
    label: "Behavioral",
    description: "STAR-focused storytelling, communication, and leadership prompts."
  },
  {
    value: "technical",
    label: "Technical",
    description: "Practical tradeoff questions, debugging prompts, and architecture reasoning."
  },
  {
    value: "case",
    label: "Case",
    description: "Structured problem solving with assumptions, prioritization, and synthesis."
  }
] as const;

export const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/setup", label: "Start" },
  { href: "/history", label: "History" },
  { href: "/insights", label: "Insights" },
  { href: "/mentor", label: "Mentor" }
] as const;
