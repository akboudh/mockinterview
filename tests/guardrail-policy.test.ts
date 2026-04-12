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

  it("changes runtime findings when the loaded policy changes", () => {
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

    const restrictiveFindings = inspectForGuardrails("This answer sounds hopeless.", {
      loadPolicy: () => restrictivePolicy
    });
    const relaxedFindings = inspectForGuardrails("This answer sounds hopeless.", {
      loadPolicy: () => relaxedPolicy
    });

    expect(restrictiveFindings).toHaveLength(1);
    expect(restrictiveFindings[0]?.flag_category).toBe("demoralizing_feedback");
    expect(relaxedFindings).toHaveLength(0);
  });
});
