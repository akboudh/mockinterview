import { readFileSync, statSync } from "fs";
import path from "path";

import YAML from "yaml";
import { z } from "zod";

import type { GuardrailRuntimePolicy } from "@/lib/types";

const flagCategorySchema = z.enum([
  "bias",
  "toxicity",
  "disallowed_question",
  "demoralizing_feedback",
  "safety"
]);

const guardrailPolicySchema = z.object({
  version: z.number().int().positive().default(1),
  policies: z
    .array(
      z.object({
        id: z.string().min(1),
        category: flagCategorySchema,
        description: z.string().min(1),
        patterns: z.array(z.string().min(1)).min(1),
        severity: z.enum(["low", "medium", "high"]).optional(),
        labels: z.array(z.string()).optional()
      })
    )
    .min(1),
  fallback_behavior: z.object({
    user_message: z.string().min(1),
    mentor_visibility: z.string().min(1)
  })
});

function policyPath() {
  const configuredPath = process.env.GUARDRAIL_POLICY_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }

  return path.join(process.cwd(), "guardrails", "policy.yaml");
}

function escapePattern(pattern: string) {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePattern(pattern: string) {
  const normalized = pattern.trim();
  const regexMatch = normalized.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexMatch) {
    const [, source, rawFlags] = regexMatch;
    const flags = rawFlags || "i";
    return new RegExp(source, flags);
  }

  const source =
    normalized.startsWith("/") && normalized.endsWith("/") && normalized.length > 2
      ? normalized.slice(1, -1)
      : `\\b${escapePattern(normalized)}\\b`;

  return new RegExp(source, "i");
}

export function normalizeGuardrailPolicy(raw: unknown): GuardrailRuntimePolicy {
  const parsed = guardrailPolicySchema.parse(raw);

  return {
    version: parsed.version,
    policies: parsed.policies.map((policy) => ({
      ...policy,
      severity: policy.severity ?? "medium",
      labels: policy.labels ?? [],
      matchers: policy.patterns.map(compilePattern)
    })),
    fallback_behavior: parsed.fallback_behavior
  };
}

let cachedPolicy: GuardrailRuntimePolicy | null = null;
let cachedPolicyPath: string | null = null;
let cachedPolicyMtimeMs = 0;

export function loadGuardrailPolicy() {
  const resolvedPath = policyPath();
  const stats = statSync(resolvedPath);

  if (
    cachedPolicy &&
    cachedPolicyPath === resolvedPath &&
    cachedPolicyMtimeMs === stats.mtimeMs
  ) {
    return cachedPolicy;
  }

  const raw = readFileSync(resolvedPath, "utf-8");
  cachedPolicy = normalizeGuardrailPolicy(YAML.parse(raw));
  cachedPolicyPath = resolvedPath;
  cachedPolicyMtimeMs = stats.mtimeMs;
  return cachedPolicy;
}

export function clearGuardrailPolicyCache() {
  cachedPolicy = null;
  cachedPolicyPath = null;
  cachedPolicyMtimeMs = 0;
}
