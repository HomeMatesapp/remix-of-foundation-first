import { describe, expect, it } from "vitest";

import { LOCATION_PRECISION_LEVELS } from "../../local-reality/codes";
import {
  REQUIRED_DEPENDENCY_OBJECTS,
  assessLocalRealityPersistenceReadiness,
  ALL_FIELD_PROJECTIONS,
  ITEM_FIELD_PROJECTIONS,
  PROJECTED_PRECISION_LEVELS,
  PROPOSED_COLUMNS,
  SNAPSHOT_FIELD_PROJECTIONS,
  SOURCE_IDENTITY_UNIQUENESS_COLUMNS,
  TYPED_REFERENCE_COLUMNS,
  WITHHELD_COLUMNS,
  type DependencyCapabilitySnapshot,
} from "..";

const ALL_PRESENT: DependencyCapabilitySnapshot = Object.fromEntries(
  REQUIRED_DEPENDENCY_OBJECTS.map((object) => [object, true]),
);

function projectionFor(canonicalField: string) {
  return ALL_FIELD_PROJECTIONS.find((field) => field.canonicalField === canonicalField);
}

function projectionForColumn(column: string) {
  return ALL_FIELD_PROJECTIONS.find((field) => field.column === column);
}

describe("Stage A vocabulary is represented exactly", () => {
  it("projects every precision level, including `coarse`", () => {
    expect(PROJECTED_PRECISION_LEVELS).toEqual([
      "full_postcode",
      "sector",
      "outward",
      "coarse",
      "none",
    ]);
    expect(PROJECTED_PRECISION_LEVELS).toEqual([...LOCATION_PRECISION_LEVELS]);
  });

  it("preserves typed-reference semantics with no polymorphic identifier", () => {
    expect(TYPED_REFERENCE_COLUMNS).toEqual({
      provider: "provider_id",
      programme: "programme_id",
      opportunity: "opportunity_id",
    });
    expect(ALL_FIELD_PROJECTIONS.some((field) => field.column === "object_id")).toBe(false);
  });

  it("preserves the source-owned identity uniqueness key exactly", () => {
    expect(SOURCE_IDENTITY_UNIQUENESS_COLUMNS).toEqual([
      "object_type",
      "source_id",
      "source_record_key",
    ]);
    expect(projectionFor("sourceRecordKey")?.column).toBe("source_record_key");
    expect(projectionFor("sourceRecordKey")?.note).toMatch(/verbatim/i);
  });

  it("maps the settled item fields to the amended relational names", () => {
    expect(projectionFor("organisationName")?.column).toBe("provider_or_employer_name");
    expect(projectionFor("approxDistanceMiles")?.column).toBe("distance_miles");
    expect(projectionFor("precisionLevel")?.column).toBe("resolution_level");
    expect(projectionFor("approxRadiusMiles")?.column).toBe("radius_miles");
    expect(projectionFor("transportModeAssumptionKey")?.classification).toBe("proven");
    expect(
      ITEM_FIELD_PROJECTIONS.filter((field) => field.canonicalField === "capturedAt"),
    ).toHaveLength(1);
  });
});

describe("privacy and envelope boundaries", () => {
  it("declares no participant location field anywhere in the projection or manifest", () => {
    const surface = JSON.stringify([
      ALL_FIELD_PROJECTIONS,
      PROPOSED_COLUMNS,
      WITHHELD_COLUMNS,
      SNAPSHOT_FIELD_PROJECTIONS,
    ]);
    expect(surface).not.toMatch(/postcode_normalised|postcodeNormalised|raw_postcode|rawPostcode/i);
    expect(surface).not.toMatch(/latitude|longitude/i);
    expect(PROPOSED_COLUMNS.some((column) => /postcode/i.test(column.column))).toBe(false);
  });

  it("classifies participant_id only as an externally supplied envelope field", () => {
    const participant = projectionForColumn("participant_id");
    expect(participant?.classification).toBe("envelope_supplied_externally");
    expect(participant?.canonicalField).toBeNull();
  });

  it("keeps spatial fields nullable, established-fact-only and never computed", () => {
    for (const column of ["centre_geog", "item_geog"]) {
      const field = projectionForColumn(column);
      expect(field?.classification).toBe("db_only_established_fact");
      expect(field?.canonicalField).toBeNull();
      expect(PROPOSED_COLUMNS.find((entry) => entry.column === column)?.nullable).toBe(true);
    }
  });
});

describe("Stage D2 resolved the four Stage D1 mapping blockers", () => {
  it("binds availability confidence and detail as proven mappings", () => {
    expect(projectionFor("availabilityConfidenceKey")?.column).toBe("availability_confidence");
    expect(projectionFor("availabilityConfidenceKey")?.classification).toBe("proven");
    expect(projectionFor("details")?.column).toBe("participant_facing_detail");
    expect(projectionFor("details")?.classification).toBe("proven");
    expect(WITHHELD_COLUMNS).toEqual([]);
  });

  it("binds schemaVersion and searchAreaLabel as proven mappings", () => {
    expect(projectionFor("schemaVersion")?.column).toBe("schema_version");
    expect(projectionFor("searchAreaLabel")?.column).toBe("search_area_label");
    expect(projectionFor("schemaVersion")?.classification).toBe("proven");
    expect(projectionFor("searchAreaLabel")?.classification).toBe("proven");
  });

  it("leaves no blocked field projection at all", () => {
    expect(
      ALL_FIELD_PROJECTIONS.filter(
        (field) => field.classification === "blocked_owner_or_vocabulary_decision",
      ),
    ).toEqual([]);
  });
});

describe("assessLocalRealityPersistenceReadiness", () => {
  it("defaults to every dependency absent and is not ready", () => {
    const result = assessLocalRealityPersistenceReadiness();
    expect(result.migrationReady).toBe(false);
    expect(result.missingDependencies).toEqual([...REQUIRED_DEPENDENCY_OBJECTS]);
    expect(result.blockerCodes).toEqual(["required_dependency_objects_absent"]);
  });

  it("becomes contract-ready once every dependency is reported present", () => {
    const result = assessLocalRealityPersistenceReadiness(ALL_PRESENT);
    expect(result.migrationReady).toBe(true);
    expect(result.missingDependencies).toEqual([]);
    expect(result.blockerCodes).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.blockedFields).toEqual([]);
  });

  it("reports partial dependency absence without becoming ready", () => {
    const result = assessLocalRealityPersistenceReadiness({ source: true, occupation: true });
    expect(result.migrationReady).toBe(false);
    expect(result.missingDependencies).toEqual([
      "route_archetype",
      "provider",
      "programme",
      "opportunity",
    ]);
    expect(result.blockerCodes).toEqual(["required_dependency_objects_absent"]);
  });

  it("is deterministic and mutates no shared contract data", () => {
    const before = JSON.stringify(ALL_FIELD_PROJECTIONS);
    const a = assessLocalRealityPersistenceReadiness(ALL_PRESENT);
    const b = assessLocalRealityPersistenceReadiness(ALL_PRESENT);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(JSON.stringify(ALL_FIELD_PROJECTIONS)).toBe(before);
    expect(a.provenFields.length).toBeGreaterThan(15);
    expect(a.blockedFields).toHaveLength(0);
  });
});

describe("Stage D1 R1 reconciliation", () => {
  it("declares the frozen relational types exactly", () => {
    const byKey = (table: string, column: string) =>
      PROPOSED_COLUMNS.find((c) => c.table === table && c.column === column);

    expect(byKey("local_snapshot", "radius_miles")?.typeExpectation).toBe("smallint");
    expect(byKey("local_snapshot", "resolution_level")?.typeExpectation).toBe("text");
    expect(byKey("local_snapshot_item", "object_type")?.typeExpectation).toBe("text");

    expect(byKey("local_snapshot_item", "availability_confidence")?.typeExpectation).toBe(
      "availability_confidence",
    );

    expect(byKey("local_snapshot", "resolution_level")?.note).toContain(
      "PROJECTED_PRECISION_LEVELS",
    );
    expect(byKey("local_snapshot_item", "object_type")?.note).toContain("PROJECTED_OBJECT_TYPES");
  });

  it("never claims a canonical item field as the source of local_snapshot_id", () => {
    const parentLink = ITEM_FIELD_PROJECTIONS.find((f) => f.column === "local_snapshot_id");
    expect(parentLink).toBeDefined();
    expect(parentLink?.canonicalField).toBeNull();
    expect(parentLink?.classification).not.toBe("proven");
    expect(parentLink?.classification).toBe("envelope_supplied_externally");

    // No item projection claims snapshot identity as item-owned canonical content.
    for (const field of ITEM_FIELD_PROJECTIONS) {
      expect(field.canonicalField ?? "").not.toMatch(/snapshotId/);
    }
  });

  it("adopts the approved availability vocabulary without attaching an order", () => {
    const availability = ITEM_FIELD_PROJECTIONS.find((f) => f.column === "availability_confidence");
    expect(availability?.note).toMatch(/NON-ORDINAL/i);
    for (const entry of [...PROPOSED_COLUMNS, ...ALL_FIELD_PROJECTIONS]) {
      expect(Object.keys(entry)).not.toContain("rank");
      expect(Object.keys(entry)).not.toContain("order");
      expect(Object.keys(entry)).not.toContain("weight");
      expect(Object.keys(entry)).not.toContain("score");
    }
  });
});
