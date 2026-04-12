import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { ModeSelectionCard } from "@/components/mode-selection-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionShell } from "@/components/ui/section-shell";
import { INTERVIEW_MODES } from "@/lib/constants";

const landingStats = [
  { label: "Interview modes", value: "3", hint: "Behavioral, Technical, Case" },
  { label: "Memory layers", value: "3", hint: "Short-term, episodic, long-term" },
  { label: "Mentor workflows", value: "2", hint: "Review and live takeover" }
];

export default function HomePage() {
  return (
    <main className="page-shell py-8 pb-20 md:py-12">
      <Reveal>
        <section className="grid-fade premium-panel relative overflow-hidden rounded-[44px] px-6 py-12 md:px-10 md:py-14">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-white/48">
                Mock Interview Preparation Agent for Career-Ready Students
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">
                Premium mock interviews that adapt, remember, evaluate, and coach.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68">
                Vantage runs psychologically safe AI interviews for internships and early-career roles,
                adapts follow-ups in real time, stores layered memory, and gives structured rubric feedback
                with mentor visibility when a session needs review.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/setup">
                    Start Mock Interview
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="#how-it-works">See How It Works</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {landingStats.map((stat, index) => (
                <Reveal key={stat.label} delay={0.08 * index}>
                  <Card className="rounded-[30px] p-5">
                    <p className="text-sm text-white/50">{stat.label}</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="text-5xl font-semibold tracking-[-0.06em] text-white">
                        {stat.value}
                      </p>
                      <p className="max-w-[12rem] text-right text-sm text-white/55">{stat.hint}</p>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <div className="mt-8 grid gap-8" id="how-it-works">
        <Reveal delay={0.05}>
          <SectionShell
            eyebrow="Product explanation"
            title="Students get a calmer, smarter practice loop than static question banks."
            description="The system collects role and context up front, runs an adaptive mock interview, stores transcript and evaluation artifacts, and uses historical weaknesses to make future sessions more useful."
          >
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Sparkles,
                  title: "Dynamic interviews",
                  copy: "Each follow-up reacts to answer content, confidence, mode, and target role."
                },
                {
                  icon: WandSparkles,
                  title: "Layered memory",
                  copy: "Current session context, full transcripts, and long-term skill signals stay available for future recall."
                },
                {
                  icon: ShieldCheck,
                  title: "Safe by design",
                  copy: "Guardrails screen questions and feedback for inappropriate, biased, hostile, or demoralizing content."
                }
              ].map((item) => (
                <Card key={item.title} className="rounded-[28px] p-5">
                  <item.icon className="h-8 w-8 text-mist" />
                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/64">{item.copy}</p>
                </Card>
              ))}
            </div>
          </SectionShell>
        </Reveal>

        <Reveal delay={0.08}>
          <SectionShell
            eyebrow="Interview modes"
            title="Three modes, one consistent coaching system."
            description="Every mode preserves the same polished student experience while changing the questioning logic and evaluation emphasis."
          >
            <div className="grid gap-4 md:grid-cols-3">
              {INTERVIEW_MODES.map((item) => (
                <ModeSelectionCard
                  key={item.value}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </div>
          </SectionShell>
        </Reveal>

        <Reveal delay={0.12}>
          <SectionShell
            eyebrow="Memory and personalization"
            title="Personalization is visible, not hidden."
            description="Short-term memory keeps the live flow coherent. Episodic memory stores every transcript and scorecard. Long-term memory tracks recurring strengths, recurring weak skills, and next-session recommendations."
          >
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="rounded-[30px] p-6">
                <p className="text-sm text-white/50">What the student sees</p>
                <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/66">
                  <li>Personalization indicator in setup and live interview</li>
                  <li>Historical weaknesses surfaced on insights pages</li>
                  <li>Next-session recommendations tied to prior evaluations</li>
                </ul>
              </Card>
              <Card className="rounded-[30px] p-6">
                <p className="text-sm text-white/50">What the system stores</p>
                <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/66">
                  <li>Session metadata, transcript messages, and evaluations</li>
                  <li>Skill signals such as strengths, weaknesses, and trends</li>
                  <li>Flag events and mentor interventions</li>
                </ul>
              </Card>
            </div>
          </SectionShell>
        </Reveal>

        <Reveal delay={0.16}>
          <SectionShell
            eyebrow="Feedback and coaching"
            title="Structured rubric feedback makes the session actionable."
            description="Every answer can be graded for clarity, structure, relevance, and soft skills, with explicit STAR analysis, growth tips, and optional evaluator self-critique."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                "Clarity",
                "Structure / STAR",
                "Relevance",
                "Soft skills demonstration"
              ].map((item) => (
                <Card key={item} className="rounded-[28px] p-5">
                  <p className="text-lg font-semibold tracking-[-0.04em] text-white">{item}</p>
                  <p className="mt-3 text-sm leading-6 text-white/64">
                    Visible on the results page with actionable improvement guidance.
                  </p>
                </Card>
              ))}
            </div>
          </SectionShell>
        </Reveal>

        <Reveal delay={0.2}>
          <SectionShell
            eyebrow="Safety and mentor support"
            title="Mentor review stays lightweight but real."
            description="Flagged sessions flow into a mentor dashboard with queue review, transcript inspection, supplemental feedback, and live takeover controls."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="rounded-[30px] p-6">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-white">
                  Constructive student-facing behavior
                </p>
                <p className="mt-4 text-sm leading-7 text-white/64">
                  Even when a guardrail triggers, the student experience stays calm and supportive.
                  The event is preserved for mentor review without exposing harmful phrasing back to the student.
                </p>
              </Card>
              <Card className="rounded-[30px] p-6">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-white">
                  Actionable mentor workflows
                </p>
                <p className="mt-4 text-sm leading-7 text-white/64">
                  Review flags, inspect transcript and rubric output, add notes, or pause a live session
                  with a mentor takeover message.
                </p>
              </Card>
            </div>
          </SectionShell>
        </Reveal>

        <Reveal delay={0.24}>
          <SectionShell
            eyebrow="Call to action"
            title="Launch the MVP flow and demo the full product loop."
            description="Start from setup, run a live interview, inspect results, browse history and insights, then switch into mentor review."
          >
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/setup">Start Mock Interview</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/mentor">Open Mentor Dashboard</Link>
              </Button>
            </div>
          </SectionShell>
        </Reveal>
      </div>
    </main>
  );
}
