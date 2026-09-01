import { describe, expect, it } from "vitest";

import { MAX_ITEM_DETAILS } from "../../local-reality/codes";
import { parseCanonicalLocalRealitySnapshot } from "../../local-reality/schema";
import { providerItem, snapshot } from "../../local-reality/__tests__/fixtures";
import {
  ALL_FIELD_PROJECTIONS,
  APPROVED_AVAILABILITY_CONFIDENCE_VALUES,
  ITEM_FIELD_PROJECTIONS,
  LOCAL_REALITY_D2_DECISIONS,
  LOCAL_REALITY_D2_DECISION_DATE,
  LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION,
  PROJECTION_BLOCKER_CODES,
  LOCAL_REALITY_D2_DECISION_VERSION,
  PARTICIPANT_FACING_DETAIL_EMPTY_EXPECTATION,
  PARTICIPANT_FACING_DETAIL_MAX_ENTRIES,
  PARTICIPANT_FACING_DETAIL_MEMBER_NAMES,
  PROPOSED_COLUMNS,
  RESOLVED_D2_BLOCKER_CODES,
  SNAPSHOT_FIELD_PROJECTIONS,
  WITHHELD_COLUMNS,
  assessLocalRealityPersistenceReadiness,
  checkRelationalBindingCompatibility,
} from "..";

const column = (table: string, name: string) =>
  PROPOSED_COLUMNS.find((c) => c.table === table && c.column === name);

const canonical = (overrides: Record<string, unknown> = {}) =>
  parseCanonicalLocalRealitySnapshot(snapshot(overrides));

describe("D2 owner decision record", () => {
  it("is pure, versioned, dated data covering every resolved mapping blocker", () => {
    expect(LOCAL_REALITY_D2_DECISION_VERSION).toBe("1.0.0");
    expect(LOCAL_REALITY_D2_DECISION_DATE).toBe("2026-08-30");
    expect(LOCAL_REALITY_D2_DECISIONS.map((d) => d.resolvesBlockerCode)).toEqual([
      ...RESOLVED_D2_BLOCKER_CODES,
    ]);
    expect(Object.isFrozen(LOCAL_REALITY_D2_DECISIONS)).toBe(true);
  });
});

describe("approved availability vocabulary", () => {
  it("has exactly the four approved members and no fifth", () => {
    expect([...APPROVED_AVAILABILITY_CONFIDENCE_VALUES]).toEqual([
      "known_available",
      "uncertain",
      "known_scarce",
      "unknown",
    ]);
    expect(APPROVED_AVAILABILITY_CONFIDENCE_VALUES).toHaveLength(4);
    expect(Object.isFrozen(APPROVED_AVAILABILITY_CONFIDENCE_VALUES)).toBe(true);
  });

  it("carries no ordinal, ranking or comparison metadata", () => {
    const vocabulary: unknown = APPROVED_AVAILABILITY_CONFIDENCE_VALUES;
    expect(Array.isArray(vocabulary)).toBe(true);
    for (const member of APPROVED_AVAILABILITY_CONFIDENCE_VALUES) {
      expect(typeof member).toBe("string");
    }
    const availability = column("local_snapshot_item", "availability_confidence");
    expect(availability?.note).toMatch(/non-ordinal/i);
    expect(availability?.typeExpectation).toBe("availability_confidence");
    expect(availability?.nullable).toBe(false);
    for (const record of [
      ...LOCAL_REALITY_D2_DECISIONS,
      LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION,
    ]) {
      for (const key of Object.keys(record)) {
        expect(key).not.toMatch(/rank|weight|score|comparator|order|severity/i);
      }
    }
    expect(availability?.note).not.toMatch(
      /\b(better|worse|higher than|lower than|ascending|descending)\b/i,
    );
  });

  it("binds an exact approved key and rejects near misses without widening", () => {
    for (const member of APPROVED_AVAILABILITY_CONFIDENCE_VALUES) {
      const ok = checkRelationalBindingCompatibility(
        canonical({ items: [providerItem({ availabilityConfidenceKey: member })] }),
      );
      expect(ok.bindable).toBe(true);
      expect(ok.issues).toEqual([]);
    }
  });

  it("keeps an arbitrary Stage A key valid upstream but unbindable here", () => {
    // Proves D2 did NOT retroactively narrow the closed Stage A fact contract.
    const parsed = canonical({
      items: [providerItem({ availabilityConfidenceKey: "some_other_governed_key" })],
    });
    expect(parsed.items[0]!.availabilityConfidenceKey).toBe("some_other_governed_key");

    const result = checkRelationalBindingCompatibility(parsed);
    expect(result.bindable).toBe(false);
    expect(result.issues).toEqual([
      {
        code: "availability_confidence_key_outside_approved_vocabulary",
        at: "items.0.availabilityConfidenceKey",
        reason: expect.any(String),
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects case and whitespace variants of an approved member", () => {
    for (const variant of ["Known_Available", "unknown_", "known-scarce", "UNCERTAIN"]) {
      const result = checkRelationalBindingCompatibility(
        canonical({ items: [providerItem({ availabilityConfidenceKey: variant })] }),
      );
      expect(result.bindable).toBe(false);
    }
  });
});

describe("resolved column mappings", () => {
  it("maps schemaVersion and searchAreaLabel exactly", () => {
    expect(column("local_snapshot", "schema_version")?.typeExpectation).toBe("text");
    expect(column("local_snapshot", "schema_version")?.nullable).toBe(false);
    expect(column("local_snapshot", "schema_version")?.note).not.toMatch(/default\s+'/i);
    expect(column("local_snapshot", "search_area_label")?.typeExpectation).toBe("text");
    expect(column("local_snapshot", "search_area_label")?.nullable).toBe(true);

    const byField = (field: string) =>
      SNAPSHOT_FIELD_PROJECTIONS.find((f) => f.canonicalField === field);
    expect(byField("schemaVersion")?.column).toBe("schema_version");
    expect(byField("searchAreaLabel")?.column).toBe("search_area_label");
  });

  it("maps details to jsonb NOT NULL with an empty ARRAY expectation", () => {
    const detail = column("local_snapshot_item", "participant_facing_detail");
    expect(detail?.typeExpectation).toBe("jsonb");
    expect(detail?.nullable).toBe(false);
    expect(PARTICIPANT_FACING_DETAIL_EMPTY_EXPECTATION).toBe("[]");
    expect(PARTICIPANT_FACING_DETAIL_EMPTY_EXPECTATION).not.toBe("{}");
    expect(detail?.note).toContain("`[]`");
    expect(detail?.note).not.toMatch(/default\s*'?\{\}/);
  });

  it("reuses the closed Stage A detail structure and bound", () => {
    expect(PARTICIPANT_FACING_DETAIL_MAX_ENTRIES).toBe(MAX_ITEM_DETAILS);
    expect([...PARTICIPANT_FACING_DETAIL_MEMBER_NAMES]).toEqual(["detailKey", "detailText"]);
  });

  it("withholds nothing further", () => {
    expect(WITHHELD_COLUMNS).toEqual([]);
  });
});

describe("untouched D1 semantics", () => {
  it("keeps envelope, spatial, typed-reference and source identity semantics", () => {
    const byColumn = (name: string) => ALL_FIELD_PROJECTIONS.find((f) => f.column === name);
    expect(byColumn("participant_id")?.classification).toBe("envelope_supplied_externally");
    expect(byColumn("local_snapshot_id")?.classification).toBe("envelope_supplied_externally");
    for (const spatial of ["centre_geog", "item_geog"]) {
      expect(byColumn(spatial)?.classification).toBe("db_only_established_fact");
      expect(byColumn(spatial)?.canonicalField).toBeNull();
      expect(column(byColumn(spatial)!.table, spatial)?.nullable).toBe(true);
    }
    expect(byColumn("source_record_key")?.note).toMatch(/verbatim/i);
    for (const typed of ["provider_id", "programme_id", "opportunity_id"]) {
      expect(ITEM_FIELD_PROJECTIONS.some((f) => f.column === typed)).toBe(true);
    }
  });

  it("introduces no participant location or coordinate field", () => {
    const surface = JSON.stringify([ALL_FIELD_PROJECTIONS, PROPOSED_COLUMNS, WITHHELD_COLUMNS]);
    expect(surface).not.toMatch(/raw_postcode|rawPostcode|postcode_normalised|postcodeNormalised/i);
    expect(surface).not.toMatch(/latitude|longitude/i);
    expect(PROPOSED_COLUMNS.some((c) => /postcode|coord|geo_point/i.test(c.column))).toBe(false);
  });
});

describe("Stage D2 R1 reconciliation", () => {
  it("holds exactly the four decisions resolving RESOLVED_D2_BLOCKER_CODES", () => {
    expect(LOCAL_REALITY_D2_DECISIONS).toHaveLength(4);
    expect(LOCAL_REALITY_D2_DECISIONS.map((d) => d.resolvesBlockerCode)).toEqual([
      ...RESOLVED_D2_BLOCKER_CODES,
    ]);
    for (const decision of LOCAL_REALITY_D2_DECISIONS) {
      expect(Object.isFrozen(decision)).toBe(true);
      expect(decision.resolvesBlockerCode).not.toBe("required_dependency_objects_absent");
    }
  });

  it("records dependency architecture as a reaffirmation, not a resolution", () => {
    expect(Object.isFrozen(LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION)).toBe(true);
    expect(LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION.reaffirmedBlockerCode).toBe(
      "required_dependency_objects_absent",
    );
    expect(
      Object.keys(LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION as unknown as Record<string, unknown>),
    ).not.toContain("resolvesBlockerCode");
    expect(LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION.reaffirmation).toMatch(/shadow/i);
    expect([...PROJECTION_BLOCKER_CODES]).toEqual(["required_dependency_objects_absent"]);
    expect(assessLocalRealityPersistenceReadiness().blockerCodes).toEqual([
      "required_dependency_objects_absent",
    ]);
  });
});
