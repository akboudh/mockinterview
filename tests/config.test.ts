import { existsSync } from "fs";
import path from "path";

import { loadAgentConfig } from "@/lib/agent/config";

describe("agent config", () => {
  it("loads a valid phase registry and state schema", () => {
    const config = loadAgentConfig();

    expect(config.phaseRegistry.default_phase).toBe("interview_setup");
    expect(config.phaseRegistry.phases.interview_round!.allowed_targets).toContain("deep_dive");
    expect(config.stateSchema.phases.session_feedback.summary_ready.required).toBe(true);
  });

  it("has analyzer and speaker skills for every registered phase", () => {
    const config = loadAgentConfig();

    for (const phase of Object.keys(config.phaseRegistry.phases)) {
      expect(existsSync(path.join(process.cwd(), `agent_config/skills/${phase}/analyzer.md`))).toBe(
        true
      );
      expect(existsSync(path.join(process.cwd(), `agent_config/skills/${phase}/speaker.md`))).toBe(
        true
      );
    }
  });
});
