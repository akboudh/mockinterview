import { z } from "zod";

import { loadGuardrailPolicy } from "@/lib/guardrails/policy-loader";
import type { FlagCategory, GuardrailRuntimePolicy } from "@/lib/types";

export interface GuardrailMatch {
  policy_id: string;
  flag_reason: string;
  flag_category: FlagCategory;
  severity: "low" | "medium" | "high";
  labels: string[];
}

export interface GuardrailInspectionRequest {
  text: string;
  source: "student" | "interviewer";
  session_id?: string | null;
  message_id?: string | null;
}

export interface GuardrailProvider {
  readonly name: string;
  inspect(params: GuardrailInspectionRequest): Promise<GuardrailMatch[]>;
}

export interface GuardrailProviderDeps {
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  loadPolicy: () => GuardrailRuntimePolicy;
}

const guardrailMatchSchema = z.object({
  policy_id: z.string().min(1),
  flag_reason: z.string().min(1),
  flag_category: z.enum([
    "bias",
    "toxicity",
    "disallowed_question",
    "demoralizing_feedback",
    "safety"
  ]),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  labels: z.array(z.string()).default([])
});

const guardrailProviderResponseSchema = z.object({
  findings: z.array(guardrailMatchSchema).default([])
});

function resolveGuardrailProviderMode(env: NodeJS.ProcessEnv) {
  return env.GUARDRAIL_PROVIDER?.trim().toLowerCase() === "external"
    ? "external"
    : "local";
}

function resolveGuardrailApiUrl(env: NodeJS.ProcessEnv) {
  const raw = env.GUARDRAIL_API_URL?.trim();
  return raw ? raw : null;
}

function resolveGuardrailTimeoutMs(env: NodeJS.ProcessEnv) {
  const parsed = Number.parseInt(env.GUARDRAIL_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
}

export class LocalYamlGuardrailProvider implements GuardrailProvider {
  readonly name = "local-yaml";

  constructor(private readonly loadPolicy: () => GuardrailRuntimePolicy = loadGuardrailPolicy) {}

  async inspect(params: GuardrailInspectionRequest) {
    const policy = this.loadPolicy();
    const findings: GuardrailMatch[] = [];

    for (const rule of policy.policies) {
      if (rule.matchers.some((pattern) => pattern.test(params.text))) {
        findings.push({
          policy_id: rule.id,
          flag_reason: rule.description,
          flag_category: rule.category,
          severity: rule.severity,
          labels: rule.labels
        });
      }
    }

    return findings;
  }
}

export class ExternalHttpGuardrailProvider implements GuardrailProvider {
  readonly name = "external-http";

  constructor(
    private readonly params: {
      url: string;
      apiKey?: string | null;
      timeoutMs: number;
      fetchImpl: typeof fetch;
    }
  ) {}

  async inspect(request: GuardrailInspectionRequest) {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (this.params.apiKey?.trim()) {
      headers.authorization = `Bearer ${this.params.apiKey.trim()}`;
    }

    const response = await this.params.fetchImpl(this.params.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.params.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`External guardrail provider returned ${response.status}.`);
    }

    const parsed = guardrailProviderResponseSchema.parse(await response.json());
    return parsed.findings;
  }
}

class FallbackGuardrailProvider implements GuardrailProvider {
  readonly name: string;

  constructor(
    private readonly primary: GuardrailProvider,
    private readonly fallback: GuardrailProvider
  ) {
    this.name = `${primary.name}-with-${fallback.name}-fallback`;
  }

  async inspect(params: GuardrailInspectionRequest) {
    try {
      return await this.primary.inspect(params);
    } catch {
      return this.fallback.inspect(params);
    }
  }
}

export function createGuardrailProvider(
  deps: Partial<GuardrailProviderDeps> = {}
): GuardrailProvider {
  const env = deps.env ?? process.env;
  const loadPolicy = deps.loadPolicy ?? loadGuardrailPolicy;
  const localProvider = new LocalYamlGuardrailProvider(loadPolicy);
  const mode = resolveGuardrailProviderMode(env);
  const url = resolveGuardrailApiUrl(env);

  if (mode !== "external" || !url) {
    return localProvider;
  }

  return new FallbackGuardrailProvider(
    new ExternalHttpGuardrailProvider({
      url,
      apiKey: env.GUARDRAIL_API_KEY ?? null,
      timeoutMs: resolveGuardrailTimeoutMs(env),
      fetchImpl: deps.fetchImpl ?? fetch
    }),
    localProvider
  );
}
