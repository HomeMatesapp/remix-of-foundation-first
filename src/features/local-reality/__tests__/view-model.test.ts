import { describe, expect, it } from "vitest";

import {
  ELECTRICIAN_PACK,
  REGISTERED_NURSE_PACK,
} from "../../../content/career-packs/architecture-tests";
import { safeEvaluateRealityCheck } from "../../../domain/decision-engine";
import {
  ARCHITECTURE_TEST_EVALUATED_AT,
  evidenceContextFor,
  scenarioAnswers,
} from "../../../content/career-packs/architecture-tests/__tests__/fixtures";
import { buildLocalRealityPresentation } from "../view-model";
import {
  MATCHING_PROGRAMME_ITEM_ID,
  nearMissItem,
  matchingItem,
  syntheticSnapshot,
  SOURCE_ID,
} from "./fixtures";

/**
 * Increment 17 Stage C — hostile presentation regressions.
 *
 * These prove the presentation reports only closed Stage A facts through the
 * closed Stage B resolver, never invents local truth, and never touches the
 * closed Decision Engine.
 */

const RN_LOCAL = REGISTERED_NURSE_PACK.localRequirements;

const FORBIDDEN_ABSENCE_LANGUAGE =
  /\b(no (provider|course|job|opportunit|vacanc)|none (exist|available)|unavailable|inaccessible|impossible|not eligible|not realistic|unmet|does not exist)\b/i;

describe("Stage C — location relevance is purpose controlled", () => {
  it("never requests or presents location for a pack with no local requirements", () => {
    expect(ELECTRICIAN_PACK.localRequirements).toHaveLength(0);
    const presentation = buildLocalRealityPresentation({
      localRequirements: ELECTRICIAN_PACK.localRequirements,
    });
    expect(presentation.locationRelevant).toBe(false);
    expect(presentation.purpose).toHaveLength(0);
    expect(presentation.requirements).toHaveLength(0);
    expect(presentation.notRelevantNote).toMatch(/do not depend on where you are/i);
  });

  it("requests location for the real Registered Nurse local requirement", () => {
    expect(RN_LOCAL.length).toBeGreaterThan(0);
    const presentation = buildLocalRealityPresentation({ localRequirements: RN_LOCAL });
    expect(presentation.locationRelevant).toBe(true);
    expect(presentation.purpose.join(" ")).toMatch(/only to look for reviewed/i);
    expect(presentation.purpose.join(" ")).toMatch(/cannot change that judgement/i);
  });
});

describe("Stage C — no snapshot means nothing negative", () => {
  it("reports location_not_supplied with no snapshot", () => {
    const presentation = buildLocalRealityPresentation({ localRequirements: RN_LOCAL });
    const [requirement] = presentation.requirements;
    expect(requirement?.state).toBe("location_not_supplied");
    expect(requirement?.items).toHaveLength(0);
    expect(requirement?.explanation).not.toMatch(FORBIDDEN_ABSENCE_LANGUAGE);
    expect(presentation.searchAreaLabel).toBeNull();
    expect(presentation.snapshotSupplied).toBe(false);
  });

  it("keeps precisionLevel none as location_not_supplied", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: syntheticSnapshot({ precisionLevel: "none", searchAreaLabel: null, items: [] }),
    });
    expect(presentation.requirements[0]?.state).toBe("location_not_supplied");
  });

  it("says honestly that the live lookup is not connected after a hand-off", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      handedOff: true,
    });
    expect(presentation.lookupNotConnectedNote).toMatch(/not connected in this build stage/i);
    expect(presentation.lookupNotConnectedNote).not.toMatch(FORBIDDEN_ABSENCE_LANGUAGE);
  });
});

describe("Stage C — exact matching only", () => {
  it("shows only the exact matching item and its established snapshot facts", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: syntheticSnapshot({ items: [matchingItem(), nearMissItem()] }),
      sourceTitleBySourceId: { [SOURCE_ID]: "Synthetic reviewed register" },
    });
    const [requirement] = presentation.requirements;
    expect(requirement?.state).toBe("matching_local_evidence_present");
    expect(requirement?.items.map((item) => item.itemId)).toEqual([MATCHING_PROGRAMME_ITEM_ID]);
    const [item] = requirement?.items ?? [];
    expect(item?.approxDistance).toBe("About 7.5 miles away, as recorded");
    expect(item?.locationLabel).toBe("Synthetic Area");
    expect(item?.provenance).toBe("Recorded from Synthetic reviewed register on 27 August 2026.");
    expect(item?.details.map((detail) => detail.detailText)).toEqual(["Full time"]);
  });

  it("does not match a near-miss or undeclared signal", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: syntheticSnapshot({ items: [nearMissItem()] }),
    });
    expect(presentation.requirements[0]?.state).toBe("local_evidence_insufficient");
    expect(presentation.requirements[0]?.items).toHaveLength(0);
  });

  it("uses insufficient-evidence wording with no absence or impossibility claim", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: syntheticSnapshot({ items: [] }),
    });
    const [requirement] = presentation.requirements;
    expect(requirement?.state).toBe("local_evidence_insufficient");
    expect(requirement?.heading).toMatch(/do not currently hold/i);
    const prose = `${requirement?.heading} ${requirement?.explanation}`;
    expect(prose).not.toMatch(FORBIDDEN_ABSENCE_LANGUAGE);
    expect(prose).toMatch(/limit of what we hold/i);
  });
});

describe("Stage C — nothing leaks and nothing internal is exposed", () => {
  it("never carries a postcode and never renders a raw stable key", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: syntheticSnapshot(),
    });
    const serialised = JSON.stringify(presentation);
    /* No full-postcode shape anywhere in the exported view-model. */
    expect(serialised).not.toMatch(/[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}/);
    expect(presentation.requirements[0]?.label).toBe("Getting to an approved nursing programme");
    expect(serialised).not.toContain("local_fact.");
    expect(serialised).not.toContain("check_local_approved_programme_access");
  });

  it("omits an unreviewed check key rather than showing it", () => {
    const presentation = buildLocalRealityPresentation({
      localRequirements: [
        {
          localRequirementKey: "unreviewed_requirement_key",
          localFactKey: "local_fact.unreviewed",
          relatedRouteKeys: [],
          purposes: ["route_availability"],
          unresolvedCheckKey: "check_unreviewed_thing",
        },
      ],
    });
    expect(presentation.requirements[0]?.label).toBeNull();
    expect(presentation.requirements[0]?.outstandingCheckLabel).toBeNull();
    expect(JSON.stringify(presentation)).not.toContain("check_unreviewed_thing");
  });

  it("never exposes or orders by availabilityConfidenceKey", () => {
    const base = syntheticSnapshot({ items: [matchingItem()] });
    const altered = syntheticSnapshot({
      items: [matchingItem({ availabilityConfidenceKey: "synthetic.zzz_other" })],
    });
    const first = buildLocalRealityPresentation({ localRequirements: RN_LOCAL, snapshot: base });
    const second = buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: altered,
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toContain("synthetic.listed");
  });
});

describe("Stage C — the closed Decision Engine is untouched", () => {
  it("evaluates the real RN scenario identically before and after presentation", () => {
    const evaluate = () =>
      safeEvaluateRealityCheck({
        pack: REGISTERED_NURSE_PACK,
        answerSnapshot: scenarioAnswers(
          REGISTERED_NURSE_PACK,
          "scenario_prospective_approved_degree_candidate",
        ),
        evidenceContext: evidenceContextFor(REGISTERED_NURSE_PACK),
        evaluatedAt: ARCHITECTURE_TEST_EVALUATED_AT,
      });

    const before = JSON.stringify(evaluate());
    buildLocalRealityPresentation({
      localRequirements: RN_LOCAL,
      snapshot: syntheticSnapshot(),
      handedOff: true,
    });
    const after = JSON.stringify(evaluate());
    expect(after).toBe(before);
  });

  it("does not mutate the supplied declarations or snapshot", () => {
    const snapshot = syntheticSnapshot();
    const before = JSON.stringify({ snapshot, declarations: RN_LOCAL });
    buildLocalRealityPresentation({ localRequirements: RN_LOCAL, snapshot });
    expect(JSON.stringify({ snapshot, declarations: RN_LOCAL })).toBe(before);
  });
});
