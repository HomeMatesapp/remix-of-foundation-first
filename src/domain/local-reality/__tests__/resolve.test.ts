import { describe, expect, it } from "vitest";

import { safeEvaluateRealityCheck } from "../../decision-engine";
import { REGISTERED_NURSE_PACK } from "../../../content/career-packs/architecture-tests";
import {
  ARCHITECTURE_TEST_EVALUATED_AT,
  evidenceContextFor,
  scenarioAnswers,
} from "../../../content/career-packs/architecture-tests/__tests__/fixtures";
import {
  LOCAL_REQUIREMENT_RESOLUTION_STATES,
  parseCanonicalLocalRealitySnapshot,
  resolveLocalRequirements,
} from "..";
import { PROGRAMME_ITEM_ID, programmeItem, providerItem, snapshot } from "./fixtures";

/**
 * Stage B resolver: pure, deterministic, exact-key-only, and strictly beside the
 * closed Decision Engine.
 */

const RN_FACT_KEY = "local_fact.nmc_approved_programme_access";
const RN_CHECK_KEY = "check_local_approved_programme_access";
const RN_REQUIREMENT_KEY = "local_approved_programme_access";

const SECOND_PROGRAMME_ITEM_ID = "6f6c6361-6c00-4000-8000-000000000902";

function rnDeclarations() {
  return REGISTERED_NURSE_PACK.localRequirements;
}

function usableSnapshotWithoutMatch() {
  return parseCanonicalLocalRealitySnapshot(snapshot({ items: [providerItem()] }));
}

function usableSnapshotWithMatch(signalKey: string = RN_FACT_KEY) {
  return parseCanonicalLocalRealitySnapshot(
    snapshot({ items: [providerItem(), programmeItem({ signalKey })] }),
  );
}

function only(resolutions: ReturnType<typeof resolveLocalRequirements>["resolutions"]) {
  expect(resolutions).toHaveLength(1);
  return resolutions[0]!;
}

/* A. vocabulary ------------------------------------------------------------ */

describe("A. local-only resolution vocabulary", () => {
  it("declares exactly the three approved local meanings", () => {
    expect([...LOCAL_REQUIREMENT_RESOLUTION_STATES]).toEqual([
      "location_not_supplied",
      "matching_local_evidence_present",
      "local_evidence_insufficient",
    ]);
  });

  it("introduces no zero-result / unavailability vocabulary", () => {
    expect(LOCAL_REQUIREMENT_RESOLUTION_STATES.join(" ")).not.toMatch(
      /no_current_example_found|unavailable|inaccessible|impossible|unmet|eligib/i,
    );
  });
});

/* B. Registered Nurse architecture-test regression ------------------------- */

describe("B. Registered Nurse local requirement resolution", () => {
  it("reports location_not_supplied and keeps the authored check outstanding with no snapshot", () => {
    const suppliedVariants: readonly (null | undefined)[] = [undefined, null];
    for (const supplied of suppliedVariants) {
      const resolution = only(
        resolveLocalRequirements({
          localRequirements: rnDeclarations(),
          snapshot: supplied,
        }).resolutions,
      );
      expect(resolution.localRequirementKey).toBe(RN_REQUIREMENT_KEY);
      expect(resolution.localFactKey).toBe(RN_FACT_KEY);
      expect(resolution.relatedRouteKeys).toEqual(["route_nmc_approved_degree"]);
      expect(resolution.purposes).toEqual(["route_availability"]);
      expect(resolution.resolution).toBe("location_not_supplied");
      expect(resolution.matchingItemIds).toEqual([]);
      expect(resolution.outstandingCheckKey).toBe(RN_CHECK_KEY);
      expect(resolution.resolvedCheckKey).toBeNull();
    }
  });

  it("treats precisionLevel none as location_not_supplied even with matching items present", () => {
    const noneSnapshot = parseCanonicalLocalRealitySnapshot(
      snapshot({
        precisionLevel: "none",
        searchAreaLabel: null,
        approxRadiusMiles: null,
        items: [programmeItem({ signalKey: RN_FACT_KEY })],
      }),
    );
    const outcome = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: noneSnapshot,
    });
    expect(outcome.locationUsable).toBe(false);
    expect(outcome.precisionLevel).toBe("none");
    const resolution = only(outcome.resolutions);
    expect(resolution.resolution).toBe("location_not_supplied");
    expect(resolution.matchingItemIds).toEqual([]);
    expect(resolution.outstandingCheckKey).toBe(RN_CHECK_KEY);
  });

  it("reports local_evidence_insufficient — never no-current-example — when nothing matches", () => {
    const outcome = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: usableSnapshotWithoutMatch(),
    });
    expect(outcome.locationUsable).toBe(true);
    const resolution = only(outcome.resolutions);
    expect(resolution.resolution).toBe("local_evidence_insufficient");
    expect(resolution.matchingItemIds).toEqual([]);
    expect(resolution.outstandingCheckKey).toBe(RN_CHECK_KEY);
    expect(resolution.resolvedCheckKey).toBeNull();
  });

  it("reports matching_local_evidence_present on an exact signal match", () => {
    const resolution = only(
      resolveLocalRequirements({
        localRequirements: rnDeclarations(),
        snapshot: usableSnapshotWithMatch(),
      }).resolutions,
    );
    expect(resolution.resolution).toBe("matching_local_evidence_present");
    expect(resolution.matchingItemIds).toEqual([PROGRAMME_ITEM_ID]);
    expect(resolution.outstandingCheckKey).toBeNull();
    expect(resolution.resolvedCheckKey).toBe(RN_CHECK_KEY);
  });

  /**
   * Stage B itself performs no trimming or case folding. Surrounding whitespace
   * is already normalised upstream by the closed shared stable-key contract, so
   * whitespace variants are not Stage B near-misses and are not asserted here.
   */
  it("does not match near-miss signal keys", () => {
    for (const nearMiss of [
      "local_fact.nmc_approved_programme_acces",
      "local_fact.nmc_approved_programme_access_v2",
      "nmc_approved_programme_access",
      "local_fact.nmc_approved_programme_ACCESS",
      "local_fact/nmc_approved_programme_access",
    ]) {
      const built = snapshot({ items: [programmeItem({ signalKey: nearMiss })] });
      const parsed = parseCanonicalLocalRealitySnapshot(built);
      const resolution = only(
        resolveLocalRequirements({
          localRequirements: rnDeclarations(),
          snapshot: parsed,
        }).resolutions,
      );
      expect(resolution.resolution).toBe("local_evidence_insufficient");
    }
  });
});

/* C. Decision Engine invariance -------------------------------------------- */

describe("C. the closed Decision Engine output is unchanged by Stage B", () => {
  function evaluateProspectiveDegreeScenario() {
    const outcome = safeEvaluateRealityCheck({
      pack: REGISTERED_NURSE_PACK,
      answerSnapshot: scenarioAnswers(
        REGISTERED_NURSE_PACK,
        "scenario_prospective_approved_degree_candidate",
      ),
      evidenceContext: evidenceContextFor(REGISTERED_NURSE_PACK),
      evaluatedAt: ARCHITECTURE_TEST_EVALUATED_AT,
    });
    if (!outcome.ok) throw new Error(`evaluation failed: ${JSON.stringify(outcome.issues)}`);
    return outcome.evaluation;
  }

  it("produces an identical evaluation before and after resolving local requirements", () => {
    const before = evaluateProspectiveDegreeScenario();
    const serialisedBefore = JSON.stringify(before);

    resolveLocalRequirements({
      localRequirements: REGISTERED_NURSE_PACK.localRequirements,
      snapshot: usableSnapshotWithMatch(),
    });
    resolveLocalRequirements({
      localRequirements: REGISTERED_NURSE_PACK.localRequirements,
      snapshot: usableSnapshotWithoutMatch(),
    });
    resolveLocalRequirements({
      localRequirements: REGISTERED_NURSE_PACK.localRequirements,
      snapshot: null,
    });

    const after = evaluateProspectiveDegreeScenario();
    expect(JSON.stringify(after)).toBe(serialisedBefore);
    expect(JSON.stringify(evaluateProspectiveDegreeScenario())).toBe(serialisedBefore);
  });

  it("leaves the protected judgement and route outputs untouched", () => {
    const evaluation = evaluateProspectiveDegreeScenario();
    const judgementBefore = evaluation.result.judgement;
    const routesBefore = JSON.stringify(evaluation.result.candidateRoutes);

    resolveLocalRequirements({
      localRequirements: REGISTERED_NURSE_PACK.localRequirements,
      snapshot: usableSnapshotWithMatch(),
    });

    expect(evaluation.result.judgement).toEqual(judgementBefore);
    expect(JSON.stringify(evaluation.result.candidateRoutes)).toBe(routesBefore);
  });
});

/* D. hostile determinism and purity ---------------------------------------- */

describe("D. hostile determinism and purity", () => {
  it("ignores undeclared snapshot signals without treating them as errors", () => {
    const outcome = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: parseCanonicalLocalRealitySnapshot(snapshot()),
    });
    const resolution = only(outcome.resolutions);
    expect(resolution.resolution).toBe("local_evidence_insufficient");
    expect(resolution.matchingItemIds).toEqual([]);
  });

  it("preserves authored requirement order across multiple declarations", () => {
    const declarations = [
      {
        localRequirementKey: "z_last_authored",
        localFactKey: "local_fact.z",
        relatedRouteKeys: [],
        purposes: ["route_availability"] as never,
        unresolvedCheckKey: null,
      },
      ...rnDeclarations(),
      {
        localRequirementKey: "a_first_alphabetically",
        localFactKey: "local_fact.a",
        relatedRouteKeys: [],
        purposes: ["route_availability"] as never,
        unresolvedCheckKey: null,
      },
    ];
    const outcome = resolveLocalRequirements({
      localRequirements: declarations,
      snapshot: usableSnapshotWithMatch(),
    });
    expect(outcome.resolutions.map((entry) => entry.localRequirementKey)).toEqual([
      "z_last_authored",
      RN_REQUIREMENT_KEY,
      "a_first_alphabetically",
    ]);
  });

  it("returns matching item ids in a deterministic canonical order", () => {
    const items = [
      programmeItem({ signalKey: RN_FACT_KEY }),
      programmeItem({
        itemId: SECOND_PROGRAMME_ITEM_ID,
        programmeId: SECOND_PROGRAMME_ITEM_ID,
        signalKey: RN_FACT_KEY,
        sourceRecordKey: "PROG/AAA/2026",
      }),
    ];
    const forward = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: parseCanonicalLocalRealitySnapshot(snapshot({ items })),
    });
    const reversed = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: parseCanonicalLocalRealitySnapshot(snapshot({ items: [...items].reverse() })),
    });
    expect(only(forward.resolutions).matchingItemIds).toEqual([
      SECOND_PROGRAMME_ITEM_ID,
      PROGRAMME_ITEM_ID,
    ]);
    expect(only(reversed.resolutions).matchingItemIds).toEqual(
      only(forward.resolutions).matchingItemIds,
    );
  });

  it("returns null check keys when the pack authored none", () => {
    const declarations = [
      {
        localRequirementKey: "no_authored_check",
        localFactKey: RN_FACT_KEY,
        relatedRouteKeys: [],
        purposes: ["route_availability"] as never,
      },
    ];
    const matched = only(
      resolveLocalRequirements({
        localRequirements: declarations,
        snapshot: usableSnapshotWithMatch(),
      }).resolutions,
    );
    expect(matched.resolution).toBe("matching_local_evidence_present");
    expect(matched.resolvedCheckKey).toBeNull();
    expect(matched.outstandingCheckKey).toBeNull();

    const unmatched = only(
      resolveLocalRequirements({ localRequirements: declarations, snapshot: null }).resolutions,
    );
    expect(unmatched.outstandingCheckKey).toBeNull();
    expect(unmatched.resolvedCheckKey).toBeNull();
  });

  it("mutates neither the supplied declarations nor the supplied snapshot", () => {
    const declarations = rnDeclarations();
    const before = JSON.stringify(declarations);
    const supplied = usableSnapshotWithMatch();
    const snapshotBefore = JSON.stringify(supplied);

    resolveLocalRequirements({ localRequirements: declarations, snapshot: supplied });

    expect(JSON.stringify(declarations)).toBe(before);
    expect(JSON.stringify(supplied)).toBe(snapshotBefore);
  });

  it("is referentially deterministic for identical input", () => {
    const supplied = usableSnapshotWithMatch();
    const first = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: supplied,
    });
    const second = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: supplied,
    });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.snapshotId).toBe(supplied.snapshotId);
  });

  it("does not read or expose the opaque availability confidence key", () => {
    const outcome = resolveLocalRequirements({
      localRequirements: rnDeclarations(),
      snapshot: usableSnapshotWithMatch(),
    });
    expect(JSON.stringify(outcome)).not.toMatch(/availabilityConfidence|source\.listed/);
  });
});
