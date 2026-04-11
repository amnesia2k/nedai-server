import { describe, expect, it } from "bun:test";

import { isAssessmentRequest } from "@/utils/assessment-intent.util";

describe("isAssessmentRequest", () => {
  it("matches assessment prompts", () => {
    expect(
      isAssessmentRequest(
        "Give me a 5-question multiple-choice quiz on chemistry.",
      ),
    ).toBe(true);
    expect(isAssessmentRequest("Create MCQ practice questions")).toBe(true);
    expect(isAssessmentRequest("Generate a true/false test")).toBe(true);
    expect(isAssessmentRequest("Show me past questions on calculus")).toBe(
      true,
    );
  });

  it("does not match normal prompts", () => {
    expect(isAssessmentRequest("Explain the quadratic formula")).toBe(false);
    expect(
      isAssessmentRequest("Use my timetable and suggest what to study today"),
    ).toBe(false);
  });
});
