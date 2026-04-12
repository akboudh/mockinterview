import { buildPersonalizationSummary, extractResumeHighlights } from "@/lib/personalization";

describe("personalization formatting", () => {
  it("formats mixed context into readable summary text", () => {
    const summary = buildPersonalizationSummary({
      personalizationEnabled: true,
      resumeText:
        "Built a campus marketplace product.\nLed weekly experiments to improve conversion.\nOwned analytics dashboards.",
      contextItems: [
        {
          memory_tier: "episodic",
          content: {
            mode: "behavioral",
            target_role: "Product Manager Intern",
            personalization_enabled: true
          },
          relevance_reason: "Relevant episodic memory"
        },
        {
          memory_tier: "long_term",
          content: {
            skill: "measurable impact",
            signal_type: "weakness",
            notes: "Needs stronger quantification"
          },
          relevance_reason: "Skill signal"
        }
      ]
    });

    expect(summary).toContain("Personalization is active.");
    expect(summary).toContain("prior behavioral practice for Product Manager Intern");
    expect(summary).not.toContain('{"mode"');
  });

  it("extracts resume highlights from meaningful lines", () => {
    const highlights = extractResumeHighlights(
      "Education\nExperience\nBuilt onboarding experiments that improved activation by 14%.\nLed a cross-functional launch for a student marketplace.\nSkills"
    );

    expect(highlights[0]).toContain("Built onboarding experiments");
    expect(highlights.length).toBeGreaterThan(1);
  });
});
