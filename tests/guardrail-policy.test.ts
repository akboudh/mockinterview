import { mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";

import {
  clearGuardrailPolicyCache,
  loadGuardrailPolicy,
  normalizeGuardrailPolicy
} from "@/lib/guardrails/policy-loader";
import { inspectForGuardrails } from "@/lib/services/guardrail-service";

describe("guardrail policy loader", () => {
  afterEach(() => {
    delete process.env.GUARDRAIL_POLICY_PATH;
    clearGuardrailPolicyCache();
  });

  it("flags the dev guardrail trigger phrase in the repo policy", async () => {
    process.env.GUARDRAIL_POLICY_PATH = path.join(process.cwd(), "guardrails", "policy.yaml");
    clearGuardrailPolicyCache();

    const findings = await inspectForGuardrails({ text: "guardrail-test", source: "student" });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.policy_id === "dev-guardrail-trigger")).toBe(true);
  });

  it("flags self-harm phrasing like 'i wanna kill myself' in the repo policy", async () => {
    process.env.GUARDRAIL_POLICY_PATH = path.join(process.cwd(), "guardrails", "policy.yaml");
    clearGuardrailPolicyCache();

    const findings = await inspectForGuardrails({ text: "i wanna kill myself", source: "student" });
    expect(findings.some((f) => f.policy_id === "self-harm-or-violence")).toBe(true);
  });

  it("loads runtime policy from YAML and normalizes defaults", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "guardrail-policy-"));
    const policyFile = path.join(tempDir, "policy.yaml");

    writeFileSync(
      policyFile,
      `
version: 1
policies:
  - id: regex-toxicity
    category: toxicity
    description: Detect custom hostile language.
    patterns:
      - "/useless|hopeless/i"
fallback_behavior:
  user_message: Stay constructive.
  mentor_visibility: Preserve the full context.
`.trim()
    );

    process.env.GUARDRAIL_POLICY_PATH = policyFile;
    clearGuardrailPolicyCache();

    const policy = loadGuardrailPolicy();

    expect(policy.policies[0]?.id).toBe("regex-toxicity");
    expect(policy.policies[0]?.severity).toBe("medium");
    expect(policy.policies[0]?.labels).toEqual([]);
    expect(policy.policies[0]?.matchers[0]?.test("That sounds useless.")).toBe(true);

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("changes runtime findings when the loaded policy changes", async () => {
    const restrictivePolicy = normalizeGuardrailPolicy({
      version: 1,
      policies: [
        {
          id: "pressure-language",
          category: "demoralizing_feedback",
          description: "Catch hopeless pressure language.",
          patterns: ["hopeless"],
          severity: "high",
          labels: ["coaching"]
        }
      ],
      fallback_behavior: {
        user_message: "Recover safely.",
        mentor_visibility: "Escalate."
      }
    });
    const relaxedPolicy = normalizeGuardrailPolicy({
      version: 1,
      policies: [
        {
          id: "different-rule",
          category: "toxicity",
          description: "Catch a different term.",
          patterns: ["insulting"],
          severity: "medium",
          labels: ["tone"]
        }
      ],
      fallback_behavior: {
        user_message: "Recover safely.",
        mentor_visibility: "Escalate."
      }
    });

    const restrictiveFindings = await inspectForGuardrails(
      {
        text: "This answer sounds hopeless.",
        source: "student"
      },
      {
        loadPolicy: () => restrictivePolicy
      }
    );
    const relaxedFindings = await inspectForGuardrails(
      {
        text: "This answer sounds hopeless.",
        source: "student"
      },
      {
        loadPolicy: () => relaxedPolicy
      }
    );

    expect(restrictiveFindings).toHaveLength(1);
    expect(restrictiveFindings[0]?.flag_category).toBe("demoralizing_feedback");
    expect(relaxedFindings).toHaveLength(0);
  });
});
