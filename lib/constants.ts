export const DEMO_USER_ID = "demo-student";
export const DEFAULT_QUESTIONS_PER_SESSION = 5;
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

/** Shown in interview UI; sent to POST /speech. Must match OpenAI TTS `voice` values for your model. */
export const INTERVIEW_TTS_VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
  { value: "coral", label: "Coral" },
  { value: "sage", label: "Sage" }
] as const;

/** Default style for mock-interview TTS (gpt-4o-mini-tts `instructions`). */
export const INTERVIEW_TTS_DEFAULT_INSTRUCTIONS =
  "Speak with warm, upbeat professional energy. Sound engaged and clear, like a friendly interviewer opening a conversation. Not monotone or robotic.";

/** Persisted in localStorage; chosen on /setup before the interview. */
export const TTS_VOICE_STORAGE_KEY = "vantage_interview_tts_voice";

export const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/setup", label: "Start" },
  { href: "/history", label: "History" },
  { href: "/insights", label: "Insights" },
  { href: "/mentor", label: "Mentor" }
] as const;
