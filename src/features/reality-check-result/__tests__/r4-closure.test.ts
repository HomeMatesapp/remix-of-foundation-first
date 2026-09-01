import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import {
  ARCHITECTURE_TEST_RESULT_COPY,
  AUTHORED_ARCHITECTURE_TEST_RESULT_COPY,
} from "../../../content/reality-check-result-copy/architecture-tests";
import { resolveRealityCheckPackBinding } from "../../career-discovery/coverage.server";
import {
  careerResultCopyByOccupationKey,
  parseCareerResultCopySet,
  resultCopyCoverageDefects,
  type CareerResultCopy,
} from "../content-schema";
import { evaluateConfirmedRealityCheck, type SubmittedAnswer } from "../evaluation.server";
import { buildResultViewModel, type ResultViewModel } from "../view-model";

/**
 * Increment 16 R4 — bounded external re-inspection reconciliation.
 *
 * Four confirmed defects, and nothing wider: duplicate authored copy keys were
 * accepted, a `true` blocking/mandatory boolean was described as "nothing
 * outstanding", the summary condition count reflected only one focus route, and
 * a requirement declared under both eligibility and practical fit could be
 * presented twice for one route.
 *
 * No Decision Engine, domain contract or schema version is touched here.
 */

const EVALUATED_AT = "2026-09-01T00:00:00Z";

function packFor(occupationKey: string) {
  const pack = ARCHITECTURE_TEST_PACKS.find(
    (candidate) => candidate.occupation.occupationKey === occupationKey,
  );
  if (!pack) throw new Error(`no pack for ${occupationKey}`);
  return pack;
}

function modelFor(occupationKey: string, answers: readonly SubmittedAnswer[]): ResultViewModel {
  const binding = resolveRealityCheckPackBinding({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    packs: ARCHITECTURE_TEST_PACKS,
  });
  if (binding.state !== "assessment_available") throw new Error("expected a binding");
  const outcome = evaluateConfirmedRealityCheck({
    occupationKey,
    declaredPack: binding.pack,
    answers,
    evaluatedAt: EVALUATED_AT,
    binding,
  });
  if (outcome.state !== "evaluated") throw new Error(`expected an evaluation: ${outcome.state}`);
  const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
  if (!copy) throw new Error("expected copy");
  return buildResultViewModel({
    evaluation: outcome.evaluation,
    evidence: outcome.evidence,
    copy,
    actionRelations: outcome.actionRelations,
  });
}

function scenarioAnswers(occupationKey: string, scenarioKey: string): readonly SubmittedAnswer[] {
  const scenario = packFor(occupationKey).scenarios.find(
    (candidate) => candidate.scenarioKey === scenarioKey,
  );
  if (!scenario) throw new Error(`no scenario ${scenarioKey}`);
  return scenario.answers.map((fixture) => ({
    question: {
      moduleCode: fixture.question.moduleCode,
      questionKey: fixture.question.questionKey,
    },
    value: fixture.value,
  }));
}

function allRoutes(model: ResultViewModel) {
  return [
    ...(model.strongestRoute ? [model.strongestRoute] : []),
    ...model.tiedTopRoutes,
    ...model.otherRoutes,
  ];
}

function authoredFor(occupationKey: string): CareerResultCopy {
  const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
  if (!copy) throw new Error("expected copy");
  return structuredClone(copy) as CareerResultCopy;
}

/* -------------------------------------------------------------------------- */
/* Defect 1 — duplicate authored keys must fail closed                        */
/* -------------------------------------------------------------------------- */

describe("R4 — duplicate authored result copy fails closed", () => {
  const OCCUPATION = ARCHITECTURE_TEST_PACKS[0]!.occupation.occupationKey;

  const COLLECTIONS: readonly (readonly [
    keyof CareerResultCopy & ("routes" | "requirements" | "barriers" | "checks" | "actions"),
    ResultCopyDefectEntity,
  ])[] = [
    ["routes", "route"],
    ["requirements", "requirement"],
    ["barriers", "barrier"],
    ["checks", "check"],
    ["actions", "action"],
  ];

  type ResultCopyDefectEntity = "route" | "requirement" | "barrier" | "check" | "action" | "factor";

  for (const [collection, entity] of COLLECTIONS) {
    it(`rejects a duplicated authored ${entity}`, () => {
      const pack = packFor(OCCUPATION);
      const copy = authoredFor(OCCUPATION);
      const entries = copy[collection] as unknown[];
      if (entries.length === 0) return;
      const duplicated = {
        ...copy,
        [collection]: [...entries, structuredClone(entries[0])],
      } as CareerResultCopy;

      const defects = resultCopyCoverageDefects(pack, duplicated);
      expect(
        defects.some((defect) => defect.kind === "duplicate" && defect.entity === entity),
      ).toBe(true);
      expect(() => parseCareerResultCopySet([duplicated], ARCHITECTURE_TEST_PACKS)).toThrow(
        /duplicate/,
      );
    });
  }

  it("rejects a duplicated authored ranking factor", () => {
    const withFactors = ARCHITECTURE_TEST_RESULT_COPY.find((entry) => entry.factors.length > 0);
    if (!withFactors) throw new Error("expected authored ranking factor copy");
    const pack = packFor(withFactors.occupationKey);
    const duplicated = {
      ...structuredClone(withFactors),
      factors: [...withFactors.factors, structuredClone(withFactors.factors[0]!)],
    } as CareerResultCopy;
    const defects = resultCopyCoverageDefects(pack, duplicated);
    expect(
      defects.some((defect) => defect.kind === "duplicate" && defect.entity === "factor"),
    ).toBe(true);
  });

  it("still accepts the real authored set", () => {
    expect(() =>
      parseCareerResultCopySet(AUTHORED_ARCHITECTURE_TEST_RESULT_COPY, ARCHITECTURE_TEST_PACKS),
    ).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Defect 2 — no "nothing outstanding" overclaim                              */
/* -------------------------------------------------------------------------- */

describe("R4 — route position wording does not overclaim", () => {
  const COMPONENT = readFileSync(
    "src/features/reality-check-result/components/reality-check-outcome.tsx",
    "utf8",
  );

  it("never claims nothing is outstanding from a blocking-only boolean", () => {
    expect(COMPONENT).not.toContain("Nothing outstanding");
    expect(COMPONENT).toContain("No blocking issue identified on your answers");
  });

  it("uses no best/closest preference language in route headings", () => {
    expect(COMPONENT).not.toContain("Closest fit");
    expect(COMPONENT).not.toContain("support best");
    expect(COMPONENT).not.toContain("Best-fit");
  });
});

/* -------------------------------------------------------------------------- */
/* Defects 3 and 4 — truthful counts, no duplicated requirement               */
/* -------------------------------------------------------------------------- */

describe("R4 — summary counts and per-route requirements are truthful", () => {
  /* Whole-catalogue sweeps are inherently slow; the timeout is explicit, not flaky. */
  it("counts every distinct outstanding requirement the result displays", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const model = modelFor(
          pack.occupation.occupationKey,
          scenarioAnswers(pack.occupation.occupationKey, scenario.scenarioKey),
        );
        const displayed = new Set(
          [...model.overallRequirements, ...allRoutes(model).flatMap((route) => route.conditions)]
            .filter((item) => item.status === "not_met" || item.status === "needs_checking")
            .map((item) => item.requirementKey),
        );
        const stated = model.summaryFacts.find((fact) => fact.startsWith("This result contains "));
        if (displayed.size === 0) {
          expect(stated ?? "").not.toMatch(/outstanding condition/);
          continue;
        }
        expect(stated).toBeDefined();
        expect(stated).toContain(
          `${displayed.size} outstanding ${displayed.size === 1 ? "condition" : "conditions"}`,
        );
      }
    }
  }, 30_000);

  it("never presents the same requirement twice within one route", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const model = modelFor(
          pack.occupation.occupationKey,
          scenarioAnswers(pack.occupation.occupationKey, scenario.scenarioKey),
        );
        for (const route of allRoutes(model)) {
          const keys = [...route.met, ...route.conditions, ...route.notApplicable].map(
            (item) => item.requirementKey,
          );
          expect(new Set(keys).size, `${route.routeKey}`).toBe(keys.length);
        }
      }
    }
  }, 30_000);

  it("keeps engine state semantics unchanged while deduplicating", () => {
    /*
     * Dedup removes repetition only: every displayed requirement identity still
     * carries exactly the engine's own state, and unknown never becomes unmet.
     */
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const model = modelFor(
          pack.occupation.occupationKey,
          scenarioAnswers(pack.occupation.occupationKey, scenario.scenarioKey),
        );
        for (const route of allRoutes(model)) {
          for (const item of route.met) expect(item.status).toBe("met");
          for (const item of route.conditions) {
            expect(["not_met", "needs_checking"]).toContain(item.status);
          }
        }
      }
    }
  }, 30_000);
});
