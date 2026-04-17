import Link from "next/link";
import { ArrowRight, CircleDashed, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionShell } from "@/components/ui/section-shell";

const landingStats = [
  { label: "Modes", value: "3", hint: "Behavioral, technical, and case interviews" },
  { label: "Memory layers", value: "3", hint: "Short-term, episodic, and long-term context" },
  { label: "Mentor paths", value: "2", hint: "Async review and live takeover" }
];

const workflowSteps = [
  {
    icon: Sparkles,
    step: "01",
    title: "Brief the interviewer",
    copy: "Set the role, pacing, and optional resume context before the session starts."
  },
  {
    icon: CircleDashed,
    step: "02",
    title: "Practice with adaptive follow-ups",
    copy: "Questions react to your answers instead of following a fixed script."
  }
];

export default function HomePage() {
  return (
    <main className="page-shell page-shell-wide pt-2 pb-12 md:pt-3 md:pb-10">
      <Reveal y={16}>
        <section className="premium-panel hero-glow panel-grid relative overflow-hidden rounded-[48px] px-6 py-6 md:px-10 md:py-8">
          <div className="pointer-events-none absolute right-[-8%] top-[-12%] h-64 w-64 rounded-full bg-sky-300/10 blur-3xl motion-safe:animate-pulseSoft" />
          <div className="pointer-events-none absolute bottom-[-16%] left-[12%] h-56 w-56 rounded-full bg-orange-300/10 blur-3xl" />
          <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-start">
            <div className="max-w-2xl">
              <p className="eyebrow-copy text-white/48">Mock interview practice</p>
              <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
                Interviews that adapt, remember, and coach.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/68 md:text-lg">
                Practice for internships and early roles with adaptive follow-ups, structured scoring,
                and optional mentor review without wading through static question banks.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild className="transition-transform duration-200 hover:-translate-y-0.5">
                  <Link href="/setup">
                    Start interview
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="#product">How it works</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              <Card className="rounded-[34px] border border-white/12 bg-[linear-gradient(155deg,rgba(10,20,34,0.9),rgba(11,24,40,0.66))] p-5">
                <p className="eyebrow-copy text-white/45">How it works</p>
                <div className="mt-4 grid gap-4">
                  {workflowSteps.map((item) => (
                    <div
                      key={item.title}
                      className="grid gap-3 border-b border-white/10 pb-4 last:border-b-0 last:pb-0 md:grid-cols-[auto_1fr]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-mist">
                          <item.icon className="h-5 w-5" />
                        </span>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/36">{item.step}</span>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-white/60">{item.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                {landingStats.map((stat) => (
                  <Card
                    key={stat.label}
                    className="rounded-[22px] border border-white/10 bg-black/15 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-white/42">{stat.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-white">{stat.value}</p>
                    <p className="mt-2 text-sm leading-6 text-white/56">{stat.hint}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="mt-6" id="product">
        <Reveal delay={0.04} y={20}>
          <SectionShell
            eyebrow="How it works"
            title="Built to stay focused."
            description="The flow is short: set the role, answer adaptive questions, then review structured feedback."
          >
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Sparkles,
                  title: "Adaptive questions",
                  copy: "Follow-ups react to your answers instead of following a static list."
                },
                {
                  icon: WandSparkles,
                  title: "Memory that compounds",
                  copy: "Saved history helps shape what the next session should emphasize."
                },
                {
                  icon: ShieldCheck,
                  title: "Safe by default",
                  copy: "Guardrails keep tone and feedback constructive."
                }
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-mist">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-[-0.03em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{item.copy}</p>
                </div>
              ))}
            </div>
          </SectionShell>
        </Reveal>
      </div>
    </main>
  );
}
