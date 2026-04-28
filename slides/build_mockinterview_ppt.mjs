import path from "path";
import { fileURLToPath } from "url";

import pptxgen from "pptxgenjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ShapeType;

/**
 * Editable deck template for this repo.
 *
 * Goals:
 * - Modern, minimal, high-contrast styling
 * - Mostly text + simple shapes (so it stays editable)
 * - Safe margins; no overflow dependencies on rendering tools
 */

const COLORS = {
  bg: "070A12",
  panel: "0D1222",
  panel2: "0B1020",
  text: "F4F7FF",
  muted: "B7C0D9",
  accent: "5DD6FF",
  accent2: "B8FF6A",
  warn: "FFB84A",
  border: "27304B"
};

const FONT = {
  display: "Aptos Display",
  body: "Aptos"
};

function addBg(slide) {
  slide.background = { color: COLORS.bg };
}

function addHeader(slide, title, subtitle) {
  // Top-left title
  slide.addText(title, {
    x: 0.65,
    y: 0.45,
    w: 12.2,
    h: 0.55,
    fontFace: FONT.display,
    fontSize: 28,
    color: COLORS.text,
    bold: true
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.66,
      y: 1.05,
      w: 12.1,
      h: 0.4,
      fontFace: FONT.body,
      fontSize: 14,
      color: COLORS.muted
    });
  }

  // Accent divider line
  slide.addShape(ShapeType.line, {
    x: 0.65,
    y: 1.55,
    w: 12.6,
    h: 0,
    line: { color: COLORS.border, width: 1 }
  });
}

function addFooter(slide, rightText) {
  slide.addShape(ShapeType.line, {
    x: 0.65,
    y: 7.03,
    w: 12.6,
    h: 0,
    line: { color: COLORS.border, width: 1 }
  });

  slide.addText("MockInterview • Template", {
    x: 0.65,
    y: 7.12,
    w: 6.5,
    h: 0.3,
    fontFace: FONT.body,
    fontSize: 10,
    color: "7F8BB0"
  });

  if (rightText) {
    slide.addText(rightText, {
      x: 7.1,
      y: 7.12,
      w: 6.15,
      h: 0.3,
      fontFace: FONT.body,
      fontSize: 10,
      align: "right",
      color: "7F8BB0"
    });
  }
}

function addPanel(slide, { x, y, w, h, title, bodyLines }) {
  slide.addShape(ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
    radius: 10
  });

  slide.addText(title, {
    x: x + 0.35,
    y: y + 0.25,
    w: w - 0.7,
    h: 0.4,
    fontFace: FONT.display,
    fontSize: 16,
    bold: true,
    color: COLORS.text
  });

  slide.addText(bodyLines.join("\n"), {
    x: x + 0.35,
    y: y + 0.78,
    w: w - 0.7,
    h: h - 1.05,
    fontFace: FONT.body,
    fontSize: 13,
    color: COLORS.muted,
    valign: "top"
  });
}

function addBulletList(slide, { x, y, w, h, bullets }) {
  const runs = bullets.map((text) => ({ text, options: { bullet: { indent: 18 }, hanging: 6 } }));
  slide.addText(runs, {
    x,
    y,
    w,
    h,
    fontFace: FONT.body,
    fontSize: 16,
    color: COLORS.muted,
    valign: "top"
  });
}

function addChip(slide, { x, y, text, color }) {
  const paddingX = 0.22;
  const w = Math.min(6, Math.max(1.2, 0.16 * text.length + 0.9));
  slide.addShape(ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.45,
    fill: { color: "0A1022" },
    line: { color: color ?? COLORS.accent, width: 1 },
    radius: 8
  });
  slide.addText(text, {
    x: x + paddingX,
    y: y + 0.09,
    w: w - paddingX * 2,
    h: 0.3,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.text
  });
}

function slideTitle(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);

  slide.addText("Vantage Mock Interview", {
    x: 0.85,
    y: 2.35,
    w: 12.0,
    h: 0.9,
    fontFace: FONT.display,
    fontSize: 46,
    color: COLORS.text,
    bold: true
  });

  slide.addText("Local-first interview practice with mentor review, guardrails, and memory-driven personalization", {
    x: 0.88,
    y: 3.35,
    w: 11.8,
    h: 0.6,
    fontFace: FONT.body,
    fontSize: 18,
    color: COLORS.muted
  });

  addChip(slide, { x: 0.88, y: 4.25, text: "Problem → Solution → Architecture → Runtime", color: COLORS.accent });
  addChip(slide, { x: 0.88, y: 4.82, text: "Memory (3 layers) • Evaluation & Feedback • HITL • Tech stack", color: COLORS.accent2 });

  slide.addShape(ShapeType.roundRect, {
    x: 0.85,
    y: 6.15,
    w: 12.55,
    h: 0.75,
    fill: { color: COLORS.panel2 },
    line: { color: COLORS.border, width: 1 },
    radius: 12
  });

  slide.addText("[Presenter name] • [Date] • [Link to repo/demo]", {
    x: 1.1,
    y: 6.35,
    w: 12.0,
    h: 0.35,
    fontFace: FONT.body,
    fontSize: 14,
    color: COLORS.muted
  });
}

function slideProblem(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Problem", "Why students struggle to improve interview performance");

  addPanel(slide, {
    x: 0.65,
    y: 1.85,
    w: 6.25,
    h: 4.85,
    title: "Pain points",
    bodyLines: [
      "• Practice is inconsistent and unstructured",
      "• Feedback is delayed / generic / hard to act on",
      "• No “memory” across sessions (same mistakes repeat)",
      "• Safety concerns (self-harm / harassment / bias)",
      "",
      "[Replace with your target users + evidence: surveys, quotes, metrics]"
    ]
  });

  addPanel(slide, {
    x: 7.05,
    y: 1.85,
    w: 6.2,
    h: 4.85,
    title: "What “good” looks like",
    bodyLines: [
      "• Guided loop: question → answer → evaluation → next question",
      "• Clear scoring + STAR breakdown + growth tips",
      "• Mentor feedback shows up directly in the session record",
      "• Guardrails trigger flags + mentor visibility",
      "",
      "[Replace with desired outcomes + constraints]"
    ]
  });

  addFooter(slide, "1 / 11");
}

function slideSolution(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Solution", "A guided mock interview platform with evaluation, memory, and mentor review");

  slide.addShape(ShapeType.roundRect, {
    x: 0.65,
    y: 1.85,
    w: 12.6,
    h: 4.85,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
    radius: 14
  });

  slide.addText("What we built", {
    x: 1.0,
    y: 2.15,
    w: 12.0,
    h: 0.4,
    fontFace: FONT.display,
    fontSize: 18,
    color: COLORS.text,
    bold: true
  });

  addBulletList(slide, {
    x: 1.05,
    y: 2.7,
    w: 12.1,
    h: 3.7,
    bullets: [
      "Live interview runtime (Analyzer → Orchestrator → Speaker) with phases",
      "Rubric-based evaluation (scores + STAR + tips) stored per turn",
      "Memory-driven personalization across sessions (3 layers)",
      "Guardrails with flags + mentor dashboard review",
      "Human-in-the-loop mentor feedback visible to students per session"
    ]
  });

  addFooter(slide, "2 / 11");
}

function slideArchitecture(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Architecture", "How the system fits together (local-first + optional split surfaces)");

  // Row 1: clients
  slide.addShape(ShapeType.roundRect, {
    x: 0.65,
    y: 1.9,
    w: 12.6,
    h: 1.05,
    fill: { color: COLORS.panel2 },
    line: { color: COLORS.border, width: 1 },
    radius: 12
  });
  slide.addText("Student UI (Next.js) • Mentor UI (Next.js)", {
    x: 0.95,
    y: 2.2,
    w: 12.0,
    h: 0.45,
    fontFace: FONT.display,
    fontSize: 18,
    color: COLORS.text,
    bold: true
  });
  slide.addText("Runs as one integrated app, or two origins via APP_SURFACE=student/mentor", {
    x: 0.95,
    y: 2.6,
    w: 12.0,
    h: 0.3,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.muted
  });

  // Row 2: runtime and services panels
  addPanel(slide, {
    x: 0.65,
    y: 3.2,
    w: 6.25,
    h: 3.4,
    title: "App + Runtime",
    bodyLines: [
      "• API routes (start session, ask question, evaluate)",
      "• SSE events (`/events/stream`)",
      "• Auth + roles (student / mentor)",
      "• Orchestrator service + AI provider adapter"
    ]
  });
  addPanel(slide, {
    x: 7.05,
    y: 3.2,
    w: 6.2,
    h: 3.4,
    title: "Data + Realtime",
    bodyLines: [
      "• SQLite (sessions, transcript, evaluations, flags, mentor notes)",
      "• Redis Pub/Sub (optional) for cross-process events",
      "• Fallback bridge works without Redis (dev-friendly)"
    ]
  });

  addFooter(slide, "3 / 11");
}

function slideOrchestrator(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Orchestrator runtime", "Analyzer → Orchestrator → Speaker (phase-based interview loop)");

  // Pipeline boxes
  const y = 2.25;
  const h = 1.0;
  const w = 3.9;
  const gap = 0.55;
  const x0 = 0.65;

  const steps = [
    { title: "Analyzer", desc: "Assess answer quality\nSuggest next phase" },
    { title: "Orchestrator", desc: "Select next prompt\nApply guardrails\nPersist state" },
    { title: "Speaker", desc: "Generate next question\nTone + pacing\nOptional TTS" }
  ];

  steps.forEach((s, idx) => {
    const x = x0 + idx * (w + gap);
    slide.addShape(ShapeType.roundRect, {
      x,
      y,
      w,
      h,
      fill: { color: COLORS.panel },
      line: { color: idx === 1 ? COLORS.accent : COLORS.border, width: 2 },
      radius: 14
    });
    slide.addText(s.title, {
      x: x + 0.25,
      y: y + 0.18,
      w: w - 0.5,
      h: 0.28,
      fontFace: FONT.display,
      fontSize: 18,
      bold: true,
      color: COLORS.text
    });
    slide.addText(s.desc, {
      x: x + 0.25,
      y: y + 0.5,
      w: w - 0.5,
      h: 0.45,
      fontFace: FONT.body,
      fontSize: 12,
      color: COLORS.muted
    });
    if (idx < steps.length - 1) {
      slide.addShape(ShapeType.line, {
        x: x + w,
        y: y + h / 2,
        w: gap,
        h: 0,
        line: { color: COLORS.border, width: 3, beginArrowType: "none", endArrowType: "triangle" }
      });
    }
  });

  addPanel(slide, {
    x: 0.65,
    y: 3.55,
    w: 12.6,
    h: 3.1,
    title: "Phases (example)",
    bodyLines: [
      "opening → deep_dive → interview_round → session_feedback",
      "",
      "Each turn persists:",
      "• transcript message(s)",
      "• evaluation record + scores",
      "• runtime state (phase, turn_count, summary, flags)"
    ]
  });

  addFooter(slide, "4 / 11");
}

function slideMemory(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Memory (3 layers)", "What we store and when we retrieve it");

  const colW = 4.0;
  const y = 2.05;
  const h = 4.65;

  const cols = [
    {
      title: "Short-term",
      accent: COLORS.accent,
      lines: [
        "Transcript buffer (recent turns)",
        "Used inside the current session",
        "",
        "Example:",
        "• last question + last answer",
        "• recent mentor feedback notes"
      ]
    },
    {
      title: "Episodic",
      accent: COLORS.warn,
      lines: [
        "Per-session events + evaluations",
        "Guardrail flags + reasons",
        "",
        "Example:",
        "• STAR breakdown summary",
        "• strengths / weaknesses signals"
      ]
    },
    {
      title: "Long-term",
      accent: COLORS.accent2,
      lines: [
        "Cross-session retrieval",
        "Embeddings + semantic search",
        "",
        "Example:",
        "• recurring weak skills",
        "• past feedback themes"
      ]
    }
  ];

  cols.forEach((col, i) => {
    const x = 0.65 + i * (colW + 0.3);
    slide.addShape(ShapeType.roundRect, {
      x,
      y,
      w: colW,
      h,
      fill: { color: COLORS.panel },
      line: { color: COLORS.border, width: 1 },
      radius: 14
    });
    slide.addShape(ShapeType.roundRect, {
      x: x + 0.25,
      y: y + 0.25,
      w: colW - 0.5,
      h: 0.55,
      fill: { color: "0A1022" },
      line: { color: col.accent, width: 2 },
      radius: 10
    });
    slide.addText(col.title, {
      x: x + 0.45,
      y: y + 0.38,
      w: colW - 0.9,
      h: 0.3,
      fontFace: FONT.display,
      fontSize: 16,
      bold: true,
      color: COLORS.text
    });
    slide.addText(col.lines.join("\n"), {
      x: x + 0.35,
      y: y + 0.95,
      w: colW - 0.7,
      h: h - 1.15,
      fontFace: FONT.body,
      fontSize: 13,
      color: COLORS.muted,
      valign: "top"
    });
  });

  addFooter(slide, "5 / 11");
}

function slideEvaluation(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Evaluation & feedback", "Rubric scores + STAR breakdown + growth tips + mentor notes");

  addPanel(slide, {
    x: 0.65,
    y: 1.9,
    w: 6.25,
    h: 4.7,
    title: "Automated evaluation (per answer)",
    bodyLines: [
      "• 4-dimension rubric scoring (1–5)",
      "• STAR extraction (Situation/Task/Action/Result)",
      "• Strengths + improvement areas",
      "• Actionable feedback + next tips",
      "",
      "[Add a real example screenshot/quote later]"
    ]
  });

  addPanel(slide, {
    x: 7.05,
    y: 1.9,
    w: 6.2,
    h: 4.7,
    title: "Mentor feedback (HITL)",
    bodyLines: [
      "• Mentors review sessions + flags",
      "• Leave supplemental coaching notes",
      "• Notes show up for students in:",
      "  - `/results/[sessionId]`",
      "  - `/history`",
      "",
      "[Add mentor workflow or demo GIF later]"
    ]
  });

  addFooter(slide, "6 / 11");
}

function slideGuardrails(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Guardrails & safety", "Local YAML policy + optional external provider, with mentor-visible flags");

  slide.addShape(ShapeType.roundRect, {
    x: 0.65,
    y: 1.95,
    w: 12.6,
    h: 4.65,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
    radius: 14
  });

  slide.addText("How safety works", {
    x: 1.0,
    y: 2.25,
    w: 12.0,
    h: 0.35,
    fontFace: FONT.display,
    fontSize: 18,
    bold: true,
    color: COLORS.text
  });

  addBulletList(slide, {
    x: 1.05,
    y: 2.75,
    w: 12.1,
    h: 2.1,
    bullets: [
      "Policy checks run on student answers (and can be reused for messages)",
      "If matched, we record a flag event + publish realtime updates",
      "Mentor dashboard shows flagged sessions + reasons",
      "External provider can be configured; local YAML remains the fallback"
    ]
  });

  slide.addShape(ShapeType.roundRect, {
    x: 1.05,
    y: 5.15,
    w: 12.0,
    h: 1.2,
    fill: { color: "0A1022" },
    line: { color: COLORS.warn, width: 2 },
    radius: 12
  });
  slide.addText("Demo trigger (dev)", {
    x: 1.35,
    y: 5.33,
    w: 5.0,
    h: 0.3,
    fontFace: FONT.display,
    fontSize: 14,
    color: COLORS.text,
    bold: true
  });
  slide.addText("Say: \"guardrail-test\" to confirm the pipeline end-to-end.", {
    x: 1.35,
    y: 5.63,
    w: 11.3,
    h: 0.3,
    fontFace: FONT.body,
    fontSize: 13,
    color: COLORS.muted
  });

  addFooter(slide, "7 / 11");
}

function slideHITL(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Human-in-the-loop (HITL)", "Mentor review loop for safety + coaching");

  addPanel(slide, {
    x: 0.65,
    y: 1.9,
    w: 6.25,
    h: 4.7,
    title: "Mentor dashboard",
    bodyLines: [
      "• View students + session list",
      "• Review flags (open → reviewed)",
      "• View transcript and evaluations",
      "• Add per-session feedback"
    ]
  });
  addPanel(slide, {
    x: 7.05,
    y: 1.9,
    w: 6.2,
    h: 4.7,
    title: "Feedback loop",
    bodyLines: [
      "Student completes a session",
      "→ mentor reviews + adds coaching note",
      "→ student sees note in results/history",
      "",
      "[Optional: mention DM thread if used]"
    ]
  });

  addFooter(slide, "8 / 11");
}

function slideTechStack(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "Tech stack", "Libraries, infra, and why we chose them");

  addPanel(slide, {
    x: 0.65,
    y: 1.9,
    w: 4.05,
    h: 4.7,
    title: "Frontend / App",
    bodyLines: [
      "Next.js (App Router)",
      "React + Tailwind CSS",
      "SSE event streams",
      "",
      "[Add UI components used]"
    ]
  });
  addPanel(slide, {
    x: 4.95,
    y: 1.9,
    w: 4.05,
    h: 4.7,
    title: "AI + Runtime",
    bodyLines: [
      "LangGraph (orchestration)",
      "LangChain (memory abstractions)",
      "OpenAI / Gemini adapters",
      "Deterministic fallback"
    ]
  });
  addPanel(slide, {
    x: 9.25,
    y: 1.9,
    w: 4.0,
    h: 4.7,
    title: "Data / Ops",
    bodyLines: [
      "SQLite (local-first)",
      "Redis (optional Pub/Sub)",
      "Vitest (tests)",
      "Docker (optional split)"
    ]
  });

  addFooter(slide, "9 / 11");
}

function slideAchievements(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addHeader(slide, "What we achieved", "Feature completeness + stability + demo-ready flows");

  slide.addShape(ShapeType.roundRect, {
    x: 0.65,
    y: 1.9,
    w: 12.6,
    h: 4.7,
    fill: { color: COLORS.panel },
    line: { color: COLORS.border, width: 1 },
    radius: 14
  });

  slide.addText("Highlights", {
    x: 1.0,
    y: 2.15,
    w: 12.0,
    h: 0.35,
    fontFace: FONT.display,
    fontSize: 18,
    color: COLORS.text,
    bold: true
  });

  addBulletList(slide, {
    x: 1.05,
    y: 2.65,
    w: 12.1,
    h: 2.1,
    bullets: [
      "End-to-end interview loop: start → ask → answer → evaluate → results",
      "Mentor flags + per-session feedback visible to students",
      "Split student/mentor dev with cookie isolation via hostnames",
      "Realtime updates via SSE (+ Redis optional)",
      "Guardrail policies with deterministic test triggers"
    ]
  });

  slide.addText("Next steps", {
    x: 1.0,
    y: 5.05,
    w: 12.0,
    h: 0.35,
    fontFace: FONT.display,
    fontSize: 18,
    color: COLORS.text,
    bold: true
  });
  slide.addText(
    "• [Add roadmap: better analytics, stronger rubrics, richer mentor workflows]\n• [Deployment + monitoring]\n• [User study / evaluation metrics]",
    {
      x: 1.05,
      y: 5.48,
      w: 12.1,
      h: 1.1,
      fontFace: FONT.body,
      fontSize: 14,
      color: COLORS.muted
    }
  );

  addFooter(slide, "10 / 11");
}

function slideClosing(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);

  slide.addText("Thanks!", {
    x: 0.85,
    y: 2.2,
    w: 12.0,
    h: 0.8,
    fontFace: FONT.display,
    fontSize: 56,
    bold: true,
    color: COLORS.text
  });

  slide.addText("Demo:\n[URL]\n\nRepo:\n[URL]", {
    x: 0.92,
    y: 3.25,
    w: 12.0,
    h: 1.6,
    fontFace: FONT.body,
    fontSize: 18,
    color: COLORS.muted
  });

  addChip(slide, { x: 0.92, y: 5.35, text: "Q&A", color: COLORS.accent });
  addFooter(slide, "11 / 11");
}

async function build() {
  const pptx = new pptxgen();
  ShapeType = pptx.ShapeType;
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "MockInterview";
  pptx.company = "MockInterview";
  pptx.subject = "MockInterview presentation template";

  // Set base theme fonts (PowerPoint will substitute if unavailable).
  pptx.theme = {
    headFontFace: FONT.display,
    bodyFontFace: FONT.body,
    lang: "en-US"
  };

  slideTitle(pptx);
  slideProblem(pptx);
  slideSolution(pptx);
  slideArchitecture(pptx);
  slideOrchestrator(pptx);
  slideMemory(pptx);
  slideEvaluation(pptx);
  slideGuardrails(pptx);
  slideHITL(pptx);
  slideTechStack(pptx);
  slideAchievements(pptx);
  slideClosing(pptx);

  const outFile = path.resolve(__dirname, "..", "MockInterview_Presentation.pptx");
  await pptx.writeFile({ fileName: outFile });
  // eslint-disable-next-line no-console
  console.log(`[ppt] wrote ${outFile}`);
}

await build();

