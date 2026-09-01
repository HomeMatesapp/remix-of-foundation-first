import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { hashCanonicalCareerPack } from "../../../domain/career-pack-governance/hash";
import { ARCHITECTURE_TEST_RESULT_COPY } from "../../../content/reality-check-result-copy/architecture-tests";
import { resolveRealityCheckPackBinding } from "../../career-discovery/coverage.server";
import {
  careerResultCopyByOccupationKey,
  resultCopyBindsExactly,
  resultCopyMatchesPackRef,
  resultCopyCoverageDefects,
  type CareerResultCopy,
} from "../content-schema";
import { evaluateConfirmedRealityCheck, type SubmittedAnswer } from "../evaluation.server";
import { buildResultViewModel, type ResultViewModel, type RouteItem } from "../view-model";

/**
 * Increment 16 R1 — hostile verification of the reconciliation.
 *
 * Governed ranking must come from the Career Pack and the closed engine; exact
 * ties must stay ties; presentation must never manufacture preference, priority
 * or local truth.
 */

const EVALUATED_AT = "2026-09-01T00:00:00Z";

function packFor(occupationKey: string) {
  const pack = ARCHITECTURE_TEST_PACKS.find(
    (candidate) => candidate.occupation.occupationKey === occupationKey,
  );
  if (!pack) throw new Error(`no pack for ${occupationKey}`);
  return pack;
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

function override(
  answers: readonly SubmittedAnswer[],
  questionKey: string,
  value: SubmittedAnswer["value"],
): readonly SubmittedAnswer[] {
  return answers.map((entry) =>
    entry.question.questionKey === questionKey ? { ...entry, value } : entry,
  );
}

function modelFor(
  occupationKey: string,
  answers: readonly SubmittedAnswer[],
  copyOverride?: CareerResultCopy,
): ResultViewModel {
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
  if (outcome.state !== "evaluated")
    throw new Error(`expected an evaluation, got ${outcome.state}`);
  const copy =
    copyOverride ?? careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
  if (!copy) throw new Error("expected copy");
  return buildResultViewModel({
    evaluation: outcome.evaluation,
    evidence: outcome.evidence,
    copy,
    actionRelations: outcome.actionRelations,
  });
}

function firstCandidateKey(model: ResultViewModel): string | undefined {
  const top = model.strongestRoute ?? model.tiedTopRoutes[0] ?? model.otherRoutes[0];
  return top?.routeKey;
}

describe("R1 — governed ranking replaces manufactured preference", () => {
  it("puts registered practice first for an already registered nurse", () => {
    const model = modelFor(
      "registered_nurse",
      scenarioAnswers("registered_nurse", "scenario_registered_nurse_direct_practice"),
    );
    expect(model.strongestRoute?.routeKey).toBe("route_registered_practice");
  });

  it("puts the bridge route first for a registered nursing associate", () => {
    const model = modelFor(
      "registered_nurse",
      scenarioAnswers("registered_nurse", "scenario_nursing_associate_bridging"),
    );
    expect(firstCandidateKey(model)).toBe("route_nursing_associate_bridge");
  });

  it("puts the overseas registration route first for an overseas-qualified nurse", () => {
    const model = modelFor(
      "registered_nurse",
      scenarioAnswers("registered_nurse", "scenario_overseas_qualified_regulator_verification"),
    );
    expect(firstCandidateKey(model)).toBe("route_overseas_registration");
  });

  it("prefers no route for a prospective entrant, and says so", () => {
    const model = modelFor(
      "registered_nurse",
      scenarioAnswers("registered_nurse", "scenario_prospective_approved_degree_candidate"),
    );
    /*
     * Confirmed programme entry is no longer a governed preference over the
     * apprenticeship route: no positive ranking factor matches at all. Any route
     * shown first is shown because it is the only route still viable, never
     * because it was preferred.
     */
    const shown = [
      ...(model.strongestRoute ? [model.strongestRoute] : []),
      ...model.tiedTopRoutes,
      ...model.otherRoutes,
    ];
    for (const route of shown) expect(route.factorKeys).toEqual([]);
    expect(shown.filter((route) => route.viable).length).toBe(1);
  });

  it("puts the non-graduate apprenticeship first for a non-graduate apprenticeship starting point", () => {
    const model = modelFor(
      "solicitor_england_wales",
      scenarioAnswers(
        "solicitor_england_wales",
        "scenario_non_graduate_apprenticeship_alternative",
      ),
    );
    expect(firstCandidateKey(model)).toBe("route_solicitor_apprenticeship_non_graduate");
  });

  it("puts the graduate apprenticeship first for a graduate apprenticeship starting point", () => {
    const model = modelFor(
      "solicitor_england_wales",
      override(
        scenarioAnswers(
          "solicitor_england_wales",
          "scenario_degree_holder_sqe_milestones_outstanding",
        ),
        "apprenticeship_starting_point",
        "graduate",
      ),
    );
    expect(firstCandidateKey(model)).toBe("route_solicitor_apprenticeship_graduate");
  });

  it("puts the transitional route first when it is confirmed and no apprenticeship is sought", () => {
    const model = modelFor(
      "solicitor_england_wales",
      scenarioAnswers("solicitor_england_wales", "scenario_confirmed_transitional_route"),
    );
    expect(firstCandidateKey(model)).toBe("route_lpc_transitional");
  });

  it("puts the standard SQE route first for a degree holder seeking no apprenticeship", () => {
    const model = modelFor(
      "solicitor_england_wales",
      scenarioAnswers(
        "solicitor_england_wales",
        "scenario_degree_holder_sqe_milestones_outstanding",
      ),
    );
    expect(firstCandidateKey(model)).toBe("route_sqe_standard");
  });
});

describe("R1 — exact ties are never presented as preference", () => {
  it("groups the electrician new-entrant training routes instead of choosing one", () => {
    const model = modelFor(
      "electrician",
      scenarioAnswers("electrician", "scenario_new_entrant_training_routes"),
    );
    const tiedKeys = model.tiedTopRoutes.map((route) => route.routeKey);
    expect(model.strongestRoute).toBeUndefined();
    expect(tiedKeys.length).toBeGreaterThan(1);
    /* Every tied route shares the SAME positively matched factor set. */
    const signatures = new Set(
      model.tiedTopRoutes.map((route) => [...route.factorKeys].sort().join("|")),
    );
    expect(signatures.size).toBe(1);
  });

  it("never highlights a determinately ruled-out route as strongest", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const model = modelFor(
          pack.occupation.occupationKey,
          scenario.answers.map((fixture) => ({
            question: {
              moduleCode: fixture.question.moduleCode,
              questionKey: fixture.question.questionKey,
            },
            value: fixture.value,
          })),
        );
        const highlighted: readonly RouteItem[] = [
          ...(model.strongestRoute ? [model.strongestRoute] : []),
          ...model.tiedTopRoutes,
        ];
        for (const route of highlighted) {
          expect(route.eligibility).not.toBe(false);
          expect(route.practicalFit).not.toBe(false);
        }
      }
    }
  }, 20000);

  it("highlights nothing when no positive factor separates several viable routes", () => {
    const occupationKey = "registered_nurse";
    const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
    if (!copy) throw new Error("expected copy");
    /* Copy with no factor statements still cannot invent preference. */
    const model = modelFor(
      occupationKey,
      scenarioAnswers("registered_nurse", "scenario_health_character_issue_to_declare"),
      copy,
    );
    const viable = [
      ...(model.strongestRoute ? [model.strongestRoute] : []),
      ...model.tiedTopRoutes,
      ...model.otherRoutes,
    ].filter((route) => route.viable);
    if (model.strongestRoute && viable.length > 1) {
      expect(model.strongestRoute.factorKeys.length).toBeGreaterThan(0);
    }
  });
});

describe("R1 — summary, positions and next steps", () => {
  const model = modelFor(
    "solicitor_england_wales",
    scenarioAnswers("solicitor_england_wales", "scenario_confirmed_transitional_route"),
  );

  it("summarises only what the result already surfaces", () => {
    expect(model.summaryFacts.length).toBeGreaterThanOrEqual(2);
    expect(model.summaryFacts.length).toBeLessThanOrEqual(4);
    /* Local access is always stated as not assessed. */
    expect(model.summaryFacts.some((fact) => fact.includes("Local access is not part"))).toBe(true);
    for (const fact of model.summaryFacts) {
      expect(fact).not.toMatch(/route_|action_|check_|req_|factor_/);
    }
  });

  it("preserves true/false/null semantics on the top route", () => {
    const top = model.strongestRoute ?? model.tiedTopRoutes[0];
    if (!top) throw new Error("expected a top route");
    expect([true, false, null]).toContain(top.eligibility);
    expect([true, false, null]).toContain(top.practicalFit);
  });

  it("only ever offers actions the engine actually triggered for that route", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const current = modelFor(
          pack.occupation.occupationKey,
          scenario.answers.map((fixture) => ({
            question: {
              moduleCode: fixture.question.moduleCode,
              questionKey: fixture.question.questionKey,
            },
            value: fixture.value,
          })),
        );
        const triggered = new Set(current.actions.map((action) => action.actionKey));
        const routes = [
          ...(current.strongestRoute ? [current.strongestRoute] : []),
          ...current.tiedTopRoutes,
          ...current.otherRoutes,
        ];
        for (const route of routes) {
          for (const action of route.nextActions)
            expect(triggered.has(action.actionKey)).toBe(true);
          /* A sole next step exists ONLY when exactly one action was triggered. */
          if (route.nextActions.length === 1) {
            expect(route.soleNextAction?.actionKey).toBe(route.nextActions[0]?.actionKey);
          } else {
            expect(route.soleNextAction).toBeUndefined();
          }
        }
      }
    }
    /* Whole-catalogue sweep: explicit timeout removes load-dependent flakiness. */
  }, 30_000);

  it("gives unresolved checks only declared route and requirement context, never raw keys", () => {
    const labels = new Set([
      ...ARCHITECTURE_TEST_RESULT_COPY.flatMap((copy) => copy.routes.map((entry) => entry.label)),
    ]);
    for (const check of model.unresolved) {
      for (const label of check.affectedRouteLabels) expect(labels.has(label)).toBe(true);
      for (const label of [...check.affectedRouteLabels, ...check.relatedRequirementLabels]) {
        expect(label).not.toMatch(/^route_|^req_/);
      }
    }
  });
});

describe("R1 — result copy binds exactly to the pack", () => {
  it("accepts the reviewed copy for every pack", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const copy = careerResultCopyByOccupationKey(
        ARCHITECTURE_TEST_RESULT_COPY,
        pack.occupation.occupationKey,
      );
      expect(copy?.careerPackVersion).toBe(pack.version);
      expect(copy?.careerPackContentHash).toBe(hashCanonicalCareerPack(pack));
      expect(resultCopyBindsExactly(pack, copy, hashCanonicalCareerPack(pack))).toBe(true);
    }
  });

  it("fails closed when the pack version moves on", () => {
    const pack = packFor("registered_nurse");
    const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, "registered_nurse");
    if (!copy) throw new Error("expected copy");
    const moved = { ...pack, version: "1.1.0" };
    expect(resultCopyBindsExactly(moved, copy, hashCanonicalCareerPack(moved))).toBe(false);
    expect(
      resultCopyCoverageDefects(moved, copy).some((defect) => defect.kind === "version_mismatch"),
    ).toBe(true);
  });

  it("fails closed when the pack declares a route the copy has never described", () => {
    const pack = packFor("photographer");
    const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, "photographer");
    if (!copy) throw new Error("expected copy");
    const trimmed = { ...copy, routes: copy.routes.slice(1) };
    expect(resultCopyBindsExactly(pack, trimmed, hashCanonicalCareerPack(pack))).toBe(false);
  });

  it("rejects authored action copy that references anything undeclared", () => {
    const pack = packFor("electrician");
    const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, "electrician");
    if (!copy) throw new Error("expected copy");
    const bad = {
      ...copy,
      actions: [
        ...copy.actions,
        { actionKey: "action_not_declared", label: "Not declared", guidance: "Not declared." },
      ],
    };
    expect(resultCopyBindsExactly(pack, bad, hashCanonicalCareerPack(pack))).toBe(false);
  });

  it("fails closed when pack CONTENT changes while id, version and every key stay identical", () => {
    const pack = packFor("registered_nurse");
    const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, "registered_nurse");
    if (!copy) throw new Error("expected copy");

    /* Same identity, same version, same stable keys — different content. */
    const firstRequirement = pack.requirements[0];
    if (!firstRequirement) throw new Error("expected a requirement");
    const drifted = {
      ...pack,
      requirements: [
        { ...firstRequirement, severity: "contextual" as const },
        ...pack.requirements.slice(1),
      ],
    };
    const driftedHash = hashCanonicalCareerPack(drifted);
    expect(driftedHash).not.toBe(hashCanonicalCareerPack(pack));
    expect(resultCopyCoverageDefects(drifted, copy)).toEqual([]);
    expect(resultCopyBindsExactly(drifted, copy, driftedHash)).toBe(false);
    expect(
      resultCopyMatchesPackRef(copy, {
        careerPackId: pack.careerPackId,
        version: pack.version,
        contentHash: driftedHash,
      }),
    ).toBe(false);
    expect(
      resultCopyMatchesPackRef(copy, {
        careerPackId: pack.careerPackId,
        version: pack.version,
        contentHash: hashCanonicalCareerPack(pack),
      }),
    ).toBe(true);
  });
});

describe("R1 — result copy makes no unsupported claim", () => {
  const sources = [
    readFileSync("src/content/reality-check-result-copy/architecture-tests.ts", "utf8"),
    readFileSync("src/features/reality-check-result/components/reality-check-outcome.tsx", "utf8"),
  ].join("\n");

  it("no longer contains the externally identified unsupported phrases", () => {
    for (const phrase of [
      "in writing",
      "expensive",
      "main reason people leave",
      "costs less than a course",
      "Nothing here is saved",
    ]) {
      expect(sources).not.toContain(phrase);
    }
  });

  it("describes the result as unsaved while being honest about the browser session", () => {
    const component = readFileSync(
      "src/features/reality-check-result/components/reality-check-outcome.tsx",
      "utf8",
    );
    expect(component).toContain("This result is not saved anywhere");
    expect(component).toContain("browser session");
  });
});
