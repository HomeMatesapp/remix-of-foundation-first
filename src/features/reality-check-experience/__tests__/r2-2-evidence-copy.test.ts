import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_QUESTION_COPY } from "../../../content/reality-check-question-copy/architecture-tests";
import { careerQuestionCopyByOccupationKey, questionCopyFor } from "../content-schema";

/**
 * Increment 15 R2.2 — evidence-copy governance regressions.
 *
 * `evidenceLater` may only describe whether the fact just asked might need
 * later confirmation. It must never invent a verification mechanism, a
 * downstream application requirement, a medical check, an employer role, a
 * document/certificate format or a provider/regulator process that the governed
 * Career Pack evidence does not support. Presentation layer only: nothing here
 * touches requirements, routes, judgement or Decision Engine semantics.
 */

function evidenceCopy(occupationKey: string, moduleCode: string, questionKey: string): string {
  const copy = careerQuestionCopyByOccupationKey(ARCHITECTURE_TEST_QUESTION_COPY, occupationKey);
  expect(copy, occupationKey).toBeDefined();
  const entry = questionCopyFor(copy!, {
    moduleCode: moduleCode as never,
    questionKey,
  });
  expect(entry, `${occupationKey}:${questionKey}`).toBeDefined();
  return entry!.evidenceLater;
}

describe("R2.2 corrected evidence copy", () => {
  it("keeps physical tolerance a self-assessment with no medical mechanism", () => {
    const text = evidenceCopy(
      "electrician",
      "physical_work_pattern",
      "height_confined_space_tolerance",
    );
    expect(text).toBe(
      "No evidence is needed for this answer; this is your own judgement of what you could manage.",
    );
    expect(text).not.toMatch(/health check|medical|doctor|occupational health|fitness test/i);
  });

  it("states current work evidence without naming an employer as confirmer", () => {
    const text = evidenceCopy("electrician", "experience", "current_work_scope");
    expect(text).toBe(
      "You may need to provide evidence of your current work and experience later.",
    );
    expect(text).not.toMatch(/employer/i);
  });

  it("keeps recognised competence evidence document-format neutral", () => {
    const text = evidenceCopy(
      "electrician",
      "qualifications",
      "recognised_qualified_competence_status",
    );
    expect(text).toBe(
      "You may need to provide evidence of this qualification or recognised competence later.",
    );
    expect(text).not.toMatch(/certificate|card|licence|license/i);
  });

  it("keeps the photography apprenticeship interest answer evidence-free", () => {
    const text = evidenceCopy("photographer", "study_availability", "apprenticeship_interest");
    expect(text).toBe(
      "No evidence is needed for this answer; it records what you are interested in.",
    );
    expect(text).not.toMatch(/qualification/i);
  });

  it("keeps the higher-education interest answer evidence-free", () => {
    const text = evidenceCopy("photographer", "study_availability", "higher_education_interest");
    expect(text).toBe(
      "No evidence is needed for this answer; it records what you are interested in.",
    );
    expect(text).not.toMatch(/qualification|course requirements/i);
  });

  it("keeps solicitor apprenticeship starting point evidence generic and mechanism-free", () => {
    const text = evidenceCopy(
      "solicitor_england_wales",
      "experience",
      "apprenticeship_starting_point",
    );
    expect(text).toBe("You may need to provide evidence of your qualification status later.");
    expect(text).not.toMatch(/certificate|employer|university|provider/i);
  });

  it("names an employer as confirmer only where employment is a governed requirement", () => {
    const governedEmployerQuestions = new Set(["degree_apprenticeship_employer_status"]);
    for (const copy of ARCHITECTURE_TEST_QUESTION_COPY) {
      for (const entry of copy.questions) {
        if (/employer/i.test(entry.evidenceLater)) {
          expect(
            governedEmployerQuestions.has(entry.question.questionKey),
            `${copy.occupationKey}:${entry.question.questionKey}`,
          ).toBe(true);
        }
      }
    }
  });

  it("never invents a medical, document-format or unsupported process mechanism", () => {
    for (const copy of ARCHITECTURE_TEST_QUESTION_COPY) {
      for (const entry of copy.questions) {
        const address = `${copy.occupationKey}:${entry.question.questionKey}`;
        expect(entry.evidenceLater, address).not.toMatch(
          /health check|medical|dbs|criminal record check|certificate|reference letter|interview|credit check/i,
        );
      }
    }
  });
});
