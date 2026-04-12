import { readFileSync } from "fs";
import path from "path";

import { z } from "zod";

import type { AgentPhase } from "@/lib/types";

const agentConfigRoot = path.join(process.cwd(), "agent_config");

const phaseRegistrySchema = z.object({
  version: z.string(),
  default_phase: z.enum([
    "interview_setup",
    "opening",
    "interview_round",
    "deep_dive",
    "session_feedback",
    "mentor_review"
  ]),
  phases: z.record(
    z.enum([
      "interview_setup",
      "opening",
      "interview_round",
      "deep_dive",
      "session_feedback",
      "mentor_review"
    ]),
    z.object({
      display_name: z.string(),
      purpose: z.string(),
      allowed_targets: z.array(
        z.enum([
          "interview_setup",
          "opening",
          "interview_round",
          "deep_dive",
          "session_feedback",
          "mentor_review"
        ])
      ),
      conditions: z.record(z.string()),
      max_turns: z.number().int().nullable(),
      auto_advance: z.boolean(),
      order: z.number().int()
    })
  )
});

const schemaField = z.object({
  type: z.string(),
  required: z.boolean(),
  update_policy: z.enum(["overwrite", "append", "conflict"]),
  default: z.unknown(),
  display_name: z.string(),
  description: z.string()
});

const stateSchema = z.object({
  version: z.string(),
  phases: z.record(z.string(), z.record(z.string(), schemaField))
});

export type LoadedAgentConfig = {
  phaseRegistry: z.infer<typeof phaseRegistrySchema>;
  stateSchema: z.infer<typeof stateSchema>;
  orchestratorRules: string;
  analyzerTemplate: string;
  speakerTemplate: string;
  summaryTemplate: string;
  phaseSkills: Record<
    AgentPhase,
    {
      analyzer: string;
      speaker: string;
    }
  >;
};

let cachedConfig: LoadedAgentConfig | null = null;

function loadText(relativePath: string) {
  return readFileSync(path.join(agentConfigRoot, relativePath), "utf-8");
}

export function loadAgentConfig(): LoadedAgentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const phaseRegistry = phaseRegistrySchema.parse(
    JSON.parse(loadText("phase_registry.json"))
  );
  const parsedStateSchema = stateSchema.parse(JSON.parse(loadText("state_schema.json")));

  const phaseSkills = Object.keys(phaseRegistry.phases).reduce<
    LoadedAgentConfig["phaseSkills"]
  >((accumulator, phase) => {
    const typedPhase = phase as AgentPhase;
    accumulator[typedPhase] = {
      analyzer: loadText(`skills/${typedPhase}/analyzer.md`),
      speaker: loadText(`skills/${typedPhase}/speaker.md`)
    };
    return accumulator;
  }, {} as LoadedAgentConfig["phaseSkills"]);

  cachedConfig = {
    phaseRegistry,
    stateSchema: parsedStateSchema,
    orchestratorRules: loadText("orchestrator_rules.md"),
    analyzerTemplate: loadText("prompts/analyzer_template.md"),
    speakerTemplate: loadText("prompts/speaker_template.md"),
    summaryTemplate: loadText("prompts/summary_template.md"),
    phaseSkills
  };

  return cachedConfig;
}

export function renderPrompt(
  template: string,
  variables: Record<string, string | number | boolean | null | undefined>
) {
  return Object.entries(variables).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, String(value ?? "")),
    template
  );
}

export function getPhaseSkill(phase: AgentPhase, kind: "analyzer" | "speaker") {
  return loadAgentConfig().phaseSkills[phase]![kind];
}

export function getAllowedTargets(phase: AgentPhase) {
  return loadAgentConfig().phaseRegistry.phases[phase]!.allowed_targets;
}

export function getDefaultPhase() {
  return loadAgentConfig().phaseRegistry.default_phase;
}
