import {
  createGuardrailProvider,
  type GuardrailInspectionRequest
} from "@/lib/guardrails/provider";
import { normalizeGuardrailPolicy } from "@/lib/guardrails/policy-loader";

const baseRequest: GuardrailInspectionRequest = {
  text: "This answer sounds hopeless.",
  source: "student"
};

describe("guardrail provider adapter", () => {
  it("falls back to the local YAML provider when the external provider fails", async () => {
    const provider = createGuardrailProvider({
      env: {
        ...process.env,
        GUARDRAIL_PROVIDER: "external",
        GUARDRAIL_API_URL: "https://guardrails.example.test/check"
      },
      fetchImpl: vi.fn(async () => {
        throw new Error("network unavailable");
      }) as unknown as typeof fetch,
      loadPolicy: () =>
        normalizeGuardrailPolicy({
          version: 1,
          policies: [
            {
              id: "hopeless-language",
              category: "demoralizing_feedback",
              description: "Catch hopeless language.",
              patterns: ["hopeless"],
              severity: "high",
              labels: ["coaching"]
            }
          ],
          fallback_behavior: {
            user_message: "Stay supportive.",
            mentor_visibility: "Escalate when needed."
          }
        })
    });

    const findings = await provider.inspect(baseRequest);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.policy_id).toBe("hopeless-language");
  });

  it("uses the external provider response when it succeeds", async () => {
    const provider = createGuardrailProvider({
      env: {
        ...process.env,
        GUARDRAIL_PROVIDER: "external",
        GUARDRAIL_API_URL: "https://guardrails.example.test/check",
        GUARDRAIL_API_KEY: "guardrails-secret"
      },
      fetchImpl: vi.fn(async (_input, init) => {
        expect(init?.headers).toMatchObject({
          authorization: "Bearer guardrails-secret"
        });
        return new Response(
          JSON.stringify({
            findings: [
              {
                policy_id: "external-toxicity",
                flag_reason: "External provider detected hostile language.",
                flag_category: "toxicity",
                severity: "medium",
                labels: ["external"]
              }
            ]
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }) as unknown as typeof fetch
    });

    const findings = await provider.inspect({
      text: "This question is bullshit.",
      source: "student"
    });

    expect(findings).toEqual([
      expect.objectContaining({
        policy_id: "external-toxicity",
        flag_category: "toxicity"
      })
    ]);
  });
});
