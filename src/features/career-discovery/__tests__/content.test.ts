import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import {
  ARCHITECTURE_TEST_RECORD_KEYS,
  ARCHITECTURE_TEST_SOURCE_IDS,
} from "../../../content/career-packs/architecture-tests/sources";
import { ARCHITECTURE_TEST_CAREER_OVERVIEWS } from "../../../content/career-overviews/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { careerOverviewSchema, parseCareerOverviews } from "../content-schema";
import { routeMappingIsExact } from "../view-model";

const EXPECTED_KEYS = [
  "electrician",
  "photographer",
  "registered_nurse",
  "solicitor_england_wales",
] as const;

/**
 * Descriptive source hosts allowed in Increment 14 presentation content. This is
 * exactly the set of Increment 11 authoritative bodies actually cited.
 */
const ALLOWED_SOURCE_HOSTS = [
  "nationalcareers.service.gov.uk",
  "www.nmc.org.uk",
  "skillsengland.education.gov.uk",
  "www.sra.org.uk",
  "rules.sra.org.uk",
  "www.electrical-ewa.org.uk",
  "www.jib.org.uk",
] as const;

/** Maps a presentation sourceKey to the Career Pack provenance body it belongs to. */
function bodyOfPresentationSourceKey(sourceKey: string): string {
  const prefixes: readonly (readonly [string, string])[] = [
    ["ncs_", "national_careers_service"],
    ["nmc_", "nmc"],
    ["skills_england_", "skills_england"],
    ["sra_", "sra"],
    ["tesp_ewa_", "tesp_ewa"],
    ["jib_ecs_", "jib_ecs"],
  ];
  const match = prefixes.find(([prefix]) => sourceKey.startsWith(prefix));
  if (!match) throw new Error(`unmapped presentation sourceKey ${sourceKey}`);
  return match[1];
}

describe("career overview presentation content", () => {
  it("covers exactly the four architecture-test occupations", () => {
    expect(
      ARCHITECTURE_TEST_CAREER_OVERVIEWS.map((entry) => entry.occupation.occupationKey)
        .slice()
        .sort(),
    ).toEqual([...EXPECTED_KEYS]);
  });

  it("strict-validates every authored overview", () => {
    for (const overview of ARCHITECTURE_TEST_CAREER_OVERVIEWS) {
      expect(careerOverviewSchema.safeParse(overview).success).toBe(true);
    }
  });

  it("binds to exact canonical occupation id and key", () => {
    for (const overview of ARCHITECTURE_TEST_CAREER_OVERVIEWS) {
      const record = ARCHITECTURE_TEST_OCCUPATIONS.find(
        (entry) => entry.occupationKey === overview.occupation.occupationKey,
      );
      expect(record).toBeDefined();
      expect(overview.occupation.occupationId).toBe(record?.occupationId);
    }
  });

  it("declares salary, work pattern and allowlisted authoritative sources for all four", () => {
    for (const overview of ARCHITECTURE_TEST_CAREER_OVERVIEWS) {
      expect(overview.salary.starterGbp).toBeGreaterThan(0);
      expect(overview.salary.experiencedGbp).toBeGreaterThanOrEqual(overview.salary.starterGbp);
      expect(overview.workPattern.typicalHours.length).toBeGreaterThan(0);
      expect(overview.sources.length).toBeGreaterThan(0);
      for (const source of overview.sources) {
        expect(ALLOWED_SOURCE_HOSTS).toContain(new URL(source.url).host);
        expect(source.checkedAt).toBe("2026-08-26");
      }
      /* Salary, hours and market context stay on national careers guidance. */
      for (const key of [
        overview.salary.sourceKey,
        overview.workPattern.sourceKey,
        overview.marketContextSourceKey,
      ]) {
        const source = overview.sources.find((entry) => entry.sourceKey === key);
        expect(new URL(source?.url ?? "").host).toBe("nationalcareers.service.gov.uk");
      }
    }
  });

  it("cites at least one declared source for every route, or an explicit verification note", () => {
    for (const overview of ARCHITECTURE_TEST_CAREER_OVERVIEWS) {
      const declared = new Set(overview.sources.map((entry) => entry.sourceKey));
      for (const route of overview.routeDisplays) {
        const keys = route.sourceKeys ?? [];
        if (keys.length === 0) {
          expect(route.verificationNote).toBeDefined();
          expect(route.verificationNote).toMatch(/verif/i);
          continue;
        }
        expect(route.verificationNote).toBeUndefined();
        expect(new Set(keys).size).toBe(keys.length);
        for (const key of keys) expect(declared.has(key)).toBe(true);
      }
    }
  });

  it("uses the narrow verification-note mechanism only where provenance is absent", () => {
    const withNote = ARCHITECTURE_TEST_CAREER_OVERVIEWS.flatMap((overview) =>
      overview.routeDisplays.filter((route) => route.verificationNote !== undefined),
    );
    expect(withNote.map((route) => route.routeKey)).toEqual([
      "route_scotland_electrotechnical_verification",
    ]);
  });

  it("keeps route citations inside the bound Career Pack's own provenance bodies", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const overview = ARCHITECTURE_TEST_CAREER_OVERVIEWS.find(
        (entry) => entry.occupation.occupationKey === pack.occupation.occupationKey,
      );
      const bodyById = new Map(
        Object.entries(ARCHITECTURE_TEST_SOURCE_IDS).map(([name, id]) => [id as string, name]),
      );
      const evidenceBody = new Map(
        pack.evidence.map((entry) => [
          entry.evidenceKey,
          bodyById.get(entry.reference.sourceId) ?? "unknown",
        ]),
      );
      const requirementEvidence = new Map(
        pack.requirements.map((entry) => [entry.requirementKey, entry.evidenceKeys]),
      );
      for (const route of pack.routes) {
        const bodies = new Set(
          [
            ...route.eligibilityRequirementKeys,
            ...route.practicalFitRequirementKeys,
            ...route.localRequirementKeys,
          ]
            .flatMap((key) => requirementEvidence.get(key) ?? [])
            .map((key) => evidenceBody.get(key) ?? "unknown"),
        );
        const display = overview?.routeDisplays.find((entry) => entry.routeKey === route.routeKey);
        for (const key of display?.sourceKeys ?? []) {
          expect(bodies.has(bodyOfPresentationSourceKey(key))).toBe(true);
        }
      }
    }
  });

  it("adds no evidence grade or participant classification to presentation content", () => {
    const serialised = JSON.stringify(ARCHITECTURE_TEST_CAREER_OVERVIEWS);
    for (const forbidden of [
      "grade",
      "participantClassification",
      "confirmed_requirement",
      "provider_dependent",
      "general_guidance",
      "evidenceStrength",
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("maps every declared Career Pack route exactly once, with no extra mapping", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const overview = ARCHITECTURE_TEST_CAREER_OVERVIEWS.find(
        (entry) => entry.occupation.occupationKey === pack.occupation.occupationKey,
      );
      expect(overview).toBeDefined();
      const declared = pack.routes.map((route) => route.routeKey).sort();
      const presented = overview?.routeDisplays.map((route) => route.routeKey).sort();
      expect(presented).toEqual(declared);
      expect(routeMappingIsExact(pack, overview?.routeDisplays ?? [])).toBe(true);
    }
  });

  it("exposes no eligibility, judgement, score or local-availability field", () => {
    const serialised = JSON.stringify(
      ARCHITECTURE_TEST_CAREER_OVERVIEWS.map((overview) => ({
        ...overview,
        /* Authored source URLs are external paths, not presentation fields. */
        sources: overview.sources.map(({ url: _url, ...rest }) => rest),
      })),
    );
    for (const forbidden of [
      "eligib",
      "practical_fit",
      "realistic_now",
      "realistic_with_conditions",
      "not_realistic_yet",
      "more_information_needed",
      "demandScore",
      "demandRating",
      "suitabilityScore",
      "routeScore",
      "confidenceScore",
      "postcode",
      "vacanc",
      "archetype",
    ]) {
      expect(serialised.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("rejects unknown fields and duplicate occupations", () => {
    const [first] = ARCHITECTURE_TEST_CAREER_OVERVIEWS;
    expect(careerOverviewSchema.safeParse({ ...first, demandRating: "high" }).success).toBe(false);
    expect(() => parseCareerOverviews([first, first])).toThrow();
  });

  it("deep-freezes authored content", () => {
    expect(Object.isFrozen(ARCHITECTURE_TEST_CAREER_OVERVIEWS)).toBe(true);
    expect(Object.isFrozen(ARCHITECTURE_TEST_CAREER_OVERVIEWS[0]?.routeDisplays)).toBe(true);
  });
});

/**
 * Exact-record binding regression. Source BODY provenance alone is not enough:
 * ST0152 is Installation and maintenance electrician and ST1017 is Domestic
 * electrician, so a same-body wrong-record substitution must fail.
 */
describe("electrician apprenticeship exact-record binding", () => {
  const pack = ARCHITECTURE_TEST_PACKS.find(
    (entry) => entry.occupation.occupationKey === "electrician",
  );
  const overview = ARCHITECTURE_TEST_CAREER_OVERVIEWS.find(
    (entry) => entry.occupation.occupationKey === "electrician",
  );

  const ST0152 = {
    sourceId: ARCHITECTURE_TEST_SOURCE_IDS.skills_england,
    sourceRecordKey: ARCHITECTURE_TEST_RECORD_KEYS.skills_england_st0152,
  } as const;
  const ST1017 = {
    sourceId: ARCHITECTURE_TEST_SOURCE_IDS.skills_england,
    sourceRecordKey: ARCHITECTURE_TEST_RECORD_KEYS.skills_england_st1017,
  } as const;

  /** Exact `sourceId + sourceRecordKey` pairs a route's own provenance relies on. */
  function routeRecordPairs(routeKey: string): readonly string[] {
    const route = pack?.routes.find((entry) => entry.routeKey === routeKey);
    const requirementEvidence = new Map(
      (pack?.requirements ?? []).map((entry) => [entry.requirementKey, entry.evidenceKeys]),
    );
    const evidenceReferences = new Map(
      (pack?.evidence ?? []).map((entry) => [entry.evidenceKey, entry.reference]),
    );
    return [
      ...(route?.eligibilityRequirementKeys ?? []),
      ...(route?.practicalFitRequirementKeys ?? []),
      ...(route?.localRequirementKeys ?? []),
    ]
      .flatMap((key) => requirementEvidence.get(key) ?? [])
      .flatMap((key) => {
        const reference = evidenceReferences.get(key);
        return reference ? [`${reference.sourceId}|${reference.sourceRecordKey}`] : [];
      });
  }

  function pair(record: { sourceId: string; sourceRecordKey: string }): string {
    return `${record.sourceId}|${record.sourceRecordKey}`;
  }

  it("binds the installation and maintenance apprenticeship to ST0152 only", () => {
    const pairs = routeRecordPairs("route_installation_maintenance_apprenticeship");
    expect(pairs).toContain(pair(ST0152));
    expect(pairs).not.toContain(pair(ST1017));
  });

  it("binds the domestic apprenticeship to ST1017 only", () => {
    const pairs = routeRecordPairs("route_domestic_apprenticeship");
    expect(pairs).toContain(pair(ST1017));
    expect(pairs).not.toContain(pair(ST0152));
  });

  it("cites the exact matching Skills England standard in participant content", () => {
    const displays = new Map(
      (overview?.routeDisplays ?? []).map((entry) => [entry.routeKey, entry.sourceKeys ?? []]),
    );
    const install = displays.get("route_installation_maintenance_apprenticeship") ?? [];
    const domestic = displays.get("route_domestic_apprenticeship") ?? [];

    expect(install).toContain("skills_england_st0152");
    expect(install).not.toContain("skills_england_st1017");
    expect(domestic).toContain("skills_england_st1017");
    expect(domestic).not.toContain("skills_england_st0152");

    /* Each cited key resolves to a declared descriptor for that exact standard. */
    const byKey = new Map((overview?.sources ?? []).map((entry) => [entry.sourceKey, entry]));
    expect(byKey.get("skills_england_st0152")?.url).toContain("st0152");
    expect(byKey.get("skills_england_st0152")?.label).toContain("ST0152");
    expect(byKey.get("skills_england_st1017")?.url).toContain("st1017");
    expect(byKey.get("skills_england_st1017")?.label).toContain("ST1017");
  });

  it("rejects a same-body wrong-record substitution", () => {
    /* Body-only checks pass for both records; exact-record checks must not. */
    expect(bodyOfPresentationSourceKey("skills_england_st0152")).toBe("skills_england");
    expect(bodyOfPresentationSourceKey("skills_england_st1017")).toBe("skills_england");
    expect(ST0152.sourceId).toBe(ST1017.sourceId);
    expect(ST0152.sourceRecordKey).not.toBe(ST1017.sourceRecordKey);

    const substituted = routeRecordPairs("route_domestic_apprenticeship").map((entry) =>
      entry === pair(ST1017) ? pair(ST0152) : entry,
    );
    expect(substituted).not.toContain(pair(ST1017));
  });
});
