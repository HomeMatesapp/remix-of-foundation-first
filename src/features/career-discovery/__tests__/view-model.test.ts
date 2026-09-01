import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_CAREER_OVERVIEWS } from "../../../content/career-overviews/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { resolveRoleAssessmentAvailability } from "../coverage.server";
import {
  buildRoleOverview,
  listCanonicalExamples,
  resolveDiscoverySubmission,
} from "../view-model";

function assessmentFor(occupationKey: string) {
  return resolveRoleAssessmentAvailability({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    packs: ARCHITECTURE_TEST_PACKS,
  });
}

function overviewFor(occupationKey: string) {
  return buildRoleOverview({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    overviews: ARCHITECTURE_TEST_CAREER_OVERVIEWS,
    packs: ARCHITECTURE_TEST_PACKS,
    assessment: assessmentFor(occupationKey),
  });
}

describe("discovery submission uses the closed Increment 12 resolver", () => {
  it("resolves all four exact canonical titles", () => {
    for (const [query, key] of [
      ["Registered Nurse", "registered_nurse"],
      ["Electrician", "electrician"],
      ["Solicitor of England and Wales", "solicitor_england_wales"],
      ["Photographer", "photographer"],
    ] as const) {
      const outcome = resolveDiscoverySubmission(ARCHITECTURE_TEST_OCCUPATIONS, query);
      expect(outcome.kind).toBe("navigate");
      if (outcome.kind === "navigate") expect(outcome.occupation.occupationKey).toBe(key);
    }
  });

  it("never silently navigates for bare Nurse or bare Solicitor", () => {
    for (const query of ["Nurse", "nurse", "Solicitor", "solicitor"]) {
      expect(resolveDiscoverySubmission(ARCHITECTURE_TEST_OCCUPATIONS, query).kind).not.toBe(
        "navigate",
      );
    }
  });

  it("never silently navigates for protected generic collision words", () => {
    for (const query of ["manager", "engineer", "officer", "consultant", "adviser"]) {
      expect(resolveDiscoverySubmission(ARCHITECTURE_TEST_OCCUPATIONS, query).kind).not.toBe(
        "navigate",
      );
    }
  });

  it("reports no confident match for unmatched text without asserting legitimacy", () => {
    const outcome = resolveDiscoverySubmission(
      ARCHITECTURE_TEST_OCCUPATIONS,
      "professional wizard of vibes",
    );
    expect(outcome.kind).toBe("no_confident_match");
    if (outcome.kind === "no_confident_match") {
      expect(outcome.rawQuery).toBe("professional wizard of vibes");
    }
  });

  it("preserves every clarification candidate when clarification occurs", () => {
    const universe = [
      ...ARCHITECTURE_TEST_OCCUPATIONS,
      {
        ...(ARCHITECTURE_TEST_OCCUPATIONS[0] as (typeof ARCHITECTURE_TEST_OCCUPATIONS)[number]),
        occupationId: "4d5e6f70-8192-4d0e-9f10-3b4c5d6e7f05",
        occupationKey: "veterinary_nurse",
        canonicalTitle: "Veterinary Nurse",
        specialisms: [],
        abbreviations: ["RN"],
      },
    ];
    const outcome = resolveDiscoverySubmission(universe, "RN");
    expect(outcome.kind).toBe("choice_required");
    if (outcome.kind === "choice_required") {
      expect(outcome.candidates.map((candidate) => candidate.occupationKey).sort()).toEqual([
        "registered_nurse",
        "veterinary_nurse",
      ]);
    }
  });

  it("lists canonical examples deterministically", () => {
    expect(
      listCanonicalExamples(ARCHITECTURE_TEST_OCCUPATIONS).map((e) => e.occupationKey),
    ).toEqual(["electrician", "photographer", "registered_nurse", "solicitor_england_wales"]);
  });
});

describe("role overview view-model", () => {
  it("fails safely for an unknown route param", () => {
    for (const key of ["not_a_role", "../etc", ""]) {
      expect(overviewFor(key)).toEqual({
        kind: "role_not_available",
        reason: "unknown_occupation",
      });
    }
  });

  it("gives all four roles full assessment availability with exact bound pack refs", () => {
    for (const record of ARCHITECTURE_TEST_OCCUPATIONS) {
      const result = overviewFor(record.occupationKey);
      expect(result.kind).toBe("role_overview");
      if (result.kind !== "role_overview") continue;
      expect(result.assessment.state).toBe("assessment_available");
      if (result.assessment.state !== "assessment_available") continue;
      const pack = ARCHITECTURE_TEST_PACKS.find(
        (entry) => entry.occupation.occupationKey === record.occupationKey,
      );
      expect(result.assessment.pack.careerPackId).toBe(pack?.careerPackId);
      expect(result.assessment.pack.version).toBe(pack?.version);
      expect(result.assessment.pack.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("renders route displays in the pack's declared order, one per declared route", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const result = overviewFor(pack.occupation.occupationKey);
      if (result.kind !== "role_overview") throw new Error("expected an overview");
      expect(result.routeDisplays.map((route) => route.routeKey)).toEqual(
        pack.routes.map((route) => route.routeKey),
      );
    }
  });

  it("exposes source label, url and checked date for every overview fact", () => {
    const result = overviewFor("electrician");
    if (result.kind !== "role_overview") throw new Error("expected an overview");
    for (const source of [
      result.salary.source,
      result.workPattern.source,
      result.marketContextSource,
    ]) {
      expect(source.url.startsWith("https://nationalcareers.service.gov.uk/")).toBe(true);
      expect(source.label.length).toBeGreaterThan(0);
      expect(source.checkedAt).toBe("2026-08-26");
    }
  });

  it("carries no eligibility, practical-fit, barrier or judgement state", () => {
    const result = overviewFor("registered_nurse");
    const serialised = JSON.stringify(result).toLowerCase();
    for (const forbidden of [
      "eligib",
      "practical_fit",
      "barrier",
      "unresolved",
      "realistic_now",
      "realistic_with_conditions",
      "not_realistic_yet",
      "more_information_needed",
      "suitability",
      "demandrating",
      "score",
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("fails closed when presentation route mapping does not match the pack exactly", () => {
    const [overview] = ARCHITECTURE_TEST_CAREER_OVERVIEWS;
    if (!overview) throw new Error("expected content");
    const tampered = {
      ...overview,
      routeDisplays: overview.routeDisplays.slice(0, 1),
    };
    const result = buildRoleOverview({
      occupationKey: overview.occupation.occupationKey,
      universe: ARCHITECTURE_TEST_OCCUPATIONS,
      overviews: [tampered],
      packs: ARCHITECTURE_TEST_PACKS,
      assessment: assessmentFor(overview.occupation.occupationKey),
    });
    expect(result).toEqual({ kind: "role_not_available", reason: "route_mapping_invalid" });
  });

  it("reports overview content unavailable rather than inventing copy", () => {
    const result = buildRoleOverview({
      occupationKey: "electrician",
      universe: ARCHITECTURE_TEST_OCCUPATIONS,
      overviews: [],
      packs: ARCHITECTURE_TEST_PACKS,
      assessment: assessmentFor("electrician"),
    });
    expect(result).toEqual({ kind: "role_not_available", reason: "overview_content_unavailable" });
  });
});
