import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_QUESTION_COPY } from "../../../content/reality-check-question-copy/architecture-tests";
import { QUESTION_MODULE_CODES } from "../../../domain/questions";
import { careerQuestionCopyByOccupationKey, questionCopySchema } from "../content-schema";
import { MODULE_INFORMATION_KINDS, buildStartScreenContent } from "../start-screen";

/**
 * Increment 15 R2.1 — bounded closure regressions.
 *
 * Exhaustive canonical start-screen mapping, truthful per-question
 * evidence-later guidance, and the explicit progress announcement. Nothing here
 * evaluates a Reality Check or introduces assessment truth.
 */

const FEATURE_DIR = join(import.meta.dirname, "..");

describe("R2.1 start-screen module mapping", () => {
  it("describes every canonical question module exactly once", () => {
    expect(Object.keys(MODULE_INFORMATION_KINDS).slice().sort()).toEqual(
      QUESTION_MODULE_CODES.slice().sort(),
    );
    const described = Object.values(MODULE_INFORMATION_KINDS);
    expect(new Set(described).size).toBe(described.length);
    for (const text of described) expect(text.trim().length).toBeGreaterThan(0);
  });

  it("never describes a module the pack does not declare", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const declared = pack.questionModules.map((module) => module.moduleCode);
      const content = buildStartScreenContent({
        careerTitle: pack.occupation.occupationKey,
        pack,
      });
      const allowed = declared.map((code) => MODULE_INFORMATION_KINDS[code]);
      for (const kind of content.informationKinds) expect(allowed).toContain(kind);
    }
  });

  it("reflects the Photographer pack's portfolio and employment modules", () => {
    const pack = ARCHITECTURE_TEST_PACKS.find(
      (candidate) => candidate.occupation.occupationKey === "photographer",
    );
    if (!pack) throw new Error("photographer pack missing");
    const content = buildStartScreenContent({ careerTitle: "Photographer", pack });
    expect(content.informationKinds).toContain(MODULE_INFORMATION_KINDS.portfolio);
    expect(content.informationKinds).toContain(MODULE_INFORMATION_KINDS.employment_income);
    /* Every declared module is described: nothing is silently omitted. */
    expect(content.informationKinds.length).toBe(
      new Set(pack.questionModules.map((module) => module.moduleCode)).size,
    );
  });
});

describe("R2.1 evidence-later guidance", () => {
  it("is authored, non-blank and conservative for every current question", () => {
    let count = 0;
    for (const copy of ARCHITECTURE_TEST_QUESTION_COPY) {
      for (const entry of copy.questions) {
        count += 1;
        expect(entry.evidenceLater.trim().length, `${entry.question.questionKey}`).toBeGreaterThan(
          0,
        );
        expect(entry.evidenceLater, entry.question.questionKey).toMatch(
          /later|no evidence is needed/i,
        );
        /* Never a promise or a guarantee about an outcome. */
        expect(entry.evidenceLater).not.toMatch(/guarantee|will be accepted|approved/i);
      }
    }
    expect(count).toBe(30);
  });

  it("is required by the presentation schema", () => {
    const base = {
      question: { moduleCode: "qualifications", questionKey: "example_question" },
      prompt: "Example prompt?",
      options: [
        { optionKey: "yes", label: "Yes" },
        { optionKey: "no", label: "No" },
      ],
    };
    expect(questionCopySchema.safeParse(base).success).toBe(false);
    expect(
      questionCopySchema.safeParse({
        ...base,
        evidenceLater: "You may need to confirm this later.",
      }).success,
    ).toBe(true);
  });

  it("cannot become an answer value or carry assessment semantics", () => {
    /* Only declared option keys can ever become answers; copy is display only. */
    for (const copy of ARCHITECTURE_TEST_QUESTION_COPY) {
      const pack = ARCHITECTURE_TEST_PACKS.find(
        (candidate) => candidate.occupation.occupationKey === copy.occupationKey,
      );
      if (!pack) throw new Error("pack missing");
      const declaredKeys = new Set(
        pack.questionModules.flatMap((module) =>
          module.questions.flatMap((question) =>
            question.input.kind === "single_select" || question.input.kind === "multi_select"
              ? [...question.input.optionKeys]
              : [],
          ),
        ),
      );
      for (const entry of copy.questions) {
        expect(declaredKeys.has(entry.evidenceLater)).toBe(false);
      }
    }
    /* The field name never appears in any domain layer. */
    const domainDir = join(import.meta.dirname, "..", "..", "..", "domain");
    const grep = (dir: string): string[] => {
      const hits: string[] = [];
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) hits.push(...grep(full));
        else if (/\.tsx?$/.test(name) && readFileSync(full, "utf8").includes("evidenceLater")) {
          hits.push(full);
        }
      }
      return hits;
    };
    expect(grep(domainDir)).toEqual([]);
  });
});

describe("R2.1 participant screen structure", () => {
  const source = readFileSync(join(FEATURE_DIR, "components", "reality-check-flow.tsx"), "utf8");

  it("announces the current visible progress to assistive technology", () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('role="status"');
    expect(source).toContain(
      "const progressLabel = `Question ${current.position} of ${current.askedCount} so far`",
    );
    /* The announcement uses the currently asked set, never a fixed total. */
    expect(source).not.toMatch(/of \$\{orderedPackQuestions/);
  });

  it("shows the evidence-later guidance with a restrained label", () => {
    expect(source).toContain("Evidence later:");
    expect(source).toContain("current.copy.evidenceLater");
  });

  it("uses the repository accessible AlertDialog primitive for restart", () => {
    expect(source).toContain("components/ui/alert-dialog");
    expect(source).toContain("AlertDialogCancel");
    expect(source).toContain("AlertDialogAction");
    /* No hand-built modal semantics remain. */
    expect(source).not.toContain('aria-modal="true"');
    expect(source).not.toContain('role="alertdialog"');
  });

  it("keeps confirm as the only destructive path", () => {
    expect(source).toContain("onClick={flow.confirmRestart}");
    const cancels = source.match(/flow\.cancelRestart/g) ?? [];
    expect(cancels.length).toBeGreaterThanOrEqual(2);
  });
});
