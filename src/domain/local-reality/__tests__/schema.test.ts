import { describe, expect, it } from "vitest";

import { MAX_ITEM_DETAILS } from "../codes";
import { looksLikeFullPostcode } from "../canonical";
import {
  parseCanonicalLocalRealitySnapshot,
  safeParseCanonicalLocalRealitySnapshot,
  validateLocalRealitySnapshot,
  type LocalRealitySnapshot,
} from "../schema";
import {
  OPPORTUNITY_ID,
  PROGRAMME_ID,
  PROVIDER_ID,
  opportunityItem,
  programmeItem,
  providerItem,
  snapshot,
} from "./fixtures";

function codesOf(input: unknown): readonly string[] {
  return validateLocalRealitySnapshot(input).issues.map((issue) => issue.code);
}

describe("valid item shapes", () => {
  it("accepts provider, programme and opportunity items", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(snapshot());
    expect(parsed.items.map((item) => item.objectType).sort()).toEqual([
      "opportunity",
      "programme",
      "provider",
    ]);
  });

  it("preserves snapshotted facts verbatim", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(snapshot());
    const programme = parsed.items.find((item) => item.objectType === "programme");
    expect(programme?.itemTitle).toBe("Installation and Maintenance Electrician apprenticeship");
    expect(programme?.approxDistanceMiles).toBe(0);
    expect(programme?.availabilityConfidenceKey).toBe("source.listed");
    expect(programme?.signalKey).toBe("apprenticeship_availability");
  });

  it("rejects unknown fields", () => {
    expect(codesOf(snapshot({ localAccessibility: "good" }))).toEqual(["schema_invalid"]);
    expect(codesOf(snapshot({ items: [providerItem({ score: 1 })] }))).toEqual(["schema_invalid"]);
  });

  it("declares no speculative observedAt field", () => {
    expect(
      codesOf(snapshot({ items: [providerItem({ observedAt: "2026-08-20T00:00:00Z" })] })),
    ).toEqual(["schema_invalid"]);
  });
});

describe("governed signal identity", () => {
  it("requires signalKey on every item", () => {
    for (const item of [providerItem, programmeItem, opportunityItem]) {
      const withoutSignal = { ...item() } as Record<string, unknown>;
      delete withoutSignal["signalKey"];
      expect(codesOf(snapshot({ items: [withoutSignal] }))).toEqual(["schema_invalid"]);
    }
  });

  it("requires a stable key shape", () => {
    expect(codesOf(snapshot({ items: [providerItem({ signalKey: "Not A Key" })] }))).toEqual([
      "schema_invalid",
    ]);
  });

  it("carries the signal without interpreting it", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [providerItem({ signalKey: "apprenticeship_availability" })] }),
    );
    expect(parsed.items[0]!.signalKey).toBe("apprenticeship_availability");
  });
});

describe("nullable snapshot fact fields", () => {
  it("accepts a provider snapshot with no invented item title", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [providerItem({ itemTitle: null })] }),
    );
    expect(parsed.items[0]!.itemTitle).toBeNull();
  });

  it("accepts an absent organisation name", () => {
    const item = { ...providerItem() } as Record<string, unknown>;
    delete item["organisationName"];
    const parsed = parseCanonicalLocalRealitySnapshot(snapshot({ items: [item] }));
    expect(parsed.items[0]!.organisationName).toBeUndefined();
  });

  it("accepts a remote or unknown-location item with no location label", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [opportunityItem({ locationLabel: null })] }),
    );
    expect(parsed.items[0]!.locationLabel).toBeNull();
  });
});

describe("typed references", () => {
  it("requires exactly one typed reference", () => {
    expect(codesOf(snapshot({ items: [providerItem({ programmeId: PROGRAMME_ID })] }))).toEqual([
      "typed_reference_mismatch",
    ]);
    expect(codesOf(snapshot({ items: [providerItem({ providerId: null })] }))).toEqual([
      "typed_reference_mismatch",
    ]);
  });

  it("requires the populated reference to match objectType", () => {
    expect(
      codesOf(
        snapshot({
          items: [providerItem({ providerId: null, programmeId: PROGRAMME_ID })],
        }),
      ),
    ).toEqual(["typed_reference_mismatch"]);
    expect(
      codesOf(
        snapshot({
          items: [opportunityItem({ opportunityId: null, providerId: PROVIDER_ID })],
        }),
      ),
    ).toEqual(["typed_reference_mismatch"]);
    expect(
      codesOf(
        snapshot({
          items: [programmeItem({ programmeId: null, opportunityId: OPPORTUNITY_ID })],
        }),
      ),
    ).toEqual(["typed_reference_mismatch"]);
  });
});

describe("identity uniqueness", () => {
  it("rejects duplicate item ids", () => {
    expect(codesOf(snapshot({ items: [providerItem(), providerItem()] }))).toEqual([
      "duplicate_item_id",
    ]);
  });

  it("rejects a duplicate source-owned identity under a different item id", () => {
    expect(
      codesOf(
        snapshot({
          items: [providerItem(), providerItem({ itemId: "6f6c6361-6c00-4000-8000-0000000001ff" })],
        }),
      ),
    ).toEqual(["duplicate_source_identity"]);
  });

  it("rejects the same source record bound to two different typed objects", () => {
    expect(
      codesOf(
        snapshot({
          items: [
            providerItem(),
            providerItem({
              itemId: "6f6c6361-6c00-4000-8000-0000000001fe",
              providerId: "6f6c6361-6c00-4000-8000-00000000029f",
            }),
          ],
        }),
      ),
    ).toEqual(["duplicate_source_identity"]);
  });

  it("rejects the same source record under a different signal or distance", () => {
    expect(
      codesOf(
        snapshot({
          items: [
            providerItem(),
            providerItem({
              itemId: "6f6c6361-6c00-4000-8000-0000000001fd",
              signalKey: "provider.other",
              approxDistanceMiles: 9,
            }),
          ],
        }),
      ),
    ).toEqual(["duplicate_source_identity"]);
  });

  it("treats the same record key under a different object type as distinct", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({
        items: [providerItem(), programmeItem({ sourceRecordKey: "PROV/10001234" })],
      }),
    );
    expect(parsed.items).toHaveLength(2);
  });
});

describe("hostile sourceRecordKey characters", () => {
  const hostile = ["A B", "A\tB", "A#B", "A@B", "A+B", "Ä/ü", '["A","B"]', 'A","B'] as const;

  it("preserves hostile external keys byte for byte", () => {
    for (const key of hostile) {
      const parsed = parseCanonicalLocalRealitySnapshot(
        snapshot({ items: [providerItem({ sourceRecordKey: key })] }),
      );
      expect(parsed.items[0]!.sourceRecordKey).toBe(key);
    }
  });

  it("cannot collide in canonical ordering or identity", () => {
    const items = hostile.map((key, index) =>
      providerItem({
        itemId: `6f6c6361-6c00-4000-8000-00000000${(index + 16).toString().padStart(4, "0")}`,
        providerId: `6f6c6361-6c00-4000-8000-00000000${(index + 32).toString().padStart(4, "0")}`,
        sourceRecordKey: key,
      }),
    );
    const parsed = parseCanonicalLocalRealitySnapshot(snapshot({ items }));
    expect(parsed.items).toHaveLength(hostile.length);
    expect(new Set(parsed.items.map((item) => item.sourceRecordKey)).size).toBe(hostile.length);
  });

  it("rejects a NUL byte the approved text projection cannot store", () => {
    expect(codesOf(snapshot({ items: [providerItem({ sourceRecordKey: "A\u0000B" })] }))).toEqual([
      "schema_invalid",
    ]);
    expect(codesOf(snapshot({ items: [providerItem({ sourceRecordKey: "\u0000" })] }))).toEqual([
      "schema_invalid",
    ]);
  });

  it("rejects a blank external key", () => {
    expect(codesOf(snapshot({ items: [providerItem({ sourceRecordKey: "   " })] }))).toEqual([
      "schema_invalid",
    ]);
  });
});

describe("approximate distance facts", () => {
  it("accepts zero and one decimal place", () => {
    for (const miles of [0, 0.1, 3.4, 12.5, 100.7]) {
      const parsed = parseCanonicalLocalRealitySnapshot(
        snapshot({ items: [providerItem({ approxDistanceMiles: miles })] }),
      );
      expect(parsed.items[0]!.approxDistanceMiles).toBe(miles);
    }
  });

  it("rejects more than one decimal place and negatives", () => {
    expect(codesOf(snapshot({ items: [providerItem({ approxDistanceMiles: 3.45 })] }))).toEqual([
      "schema_invalid",
    ]);
    expect(codesOf(snapshot({ items: [providerItem({ approxDistanceMiles: -1 })] }))).toEqual([
      "schema_invalid",
    ]);
  });

  it("stays within the approved numeric(5,1) projection width", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [providerItem({ approxDistanceMiles: 9999.9 })] }),
    );
    expect(parsed.items[0]!.approxDistanceMiles).toBe(9999.9);
    expect(codesOf(snapshot({ items: [providerItem({ approxDistanceMiles: 10000 })] }))).toEqual([
      "schema_invalid",
    ]);
  });

  it("treats an absent distance as absent, never as zero", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [providerItem({ approxDistanceMiles: null })] }),
    );
    expect(parsed.items[0]!.approxDistanceMiles).toBeNull();
  });
});

describe("precision, radius and safe labels", () => {
  it("accepts every frozen precision level", () => {
    for (const level of ["full_postcode", "sector", "outward", "coarse", "none"] as const) {
      expect(validateLocalRealitySnapshot(snapshot({ precisionLevel: level })).valid).toBe(true);
    }
    expect(codesOf(snapshot({ precisionLevel: "street" }))).toEqual(["schema_invalid"]);
  });

  it("bounds the approximate radius to 1–100 whole miles", () => {
    expect(validateLocalRealitySnapshot(snapshot({ approxRadiusMiles: 1 })).valid).toBe(true);
    expect(validateLocalRealitySnapshot(snapshot({ approxRadiusMiles: 15 })).valid).toBe(true);
    expect(validateLocalRealitySnapshot(snapshot({ approxRadiusMiles: 100 })).valid).toBe(true);
    for (const radius of [0.9, 101, 15.5, 15.25]) {
      const codes = codesOf(snapshot({ approxRadiusMiles: radius }));
      expect(codes.length).toBeGreaterThan(0);
      expect(new Set(codes)).toEqual(new Set(["schema_invalid"]));
    }
  });

  it("rejects a full-postcode-shaped participant-safe label at full precision", () => {
    expect(
      codesOf(snapshot({ precisionLevel: "full_postcode", searchAreaLabel: "S1 2HH" })),
    ).toEqual(["unsafe_location_label"]);
    expect(
      codesOf(snapshot({ precisionLevel: "full_postcode", searchAreaLabel: "s12hh" })),
    ).toEqual(["unsafe_location_label"]);
    expect(
      validateLocalRealitySnapshot(
        snapshot({ precisionLevel: "full_postcode", searchAreaLabel: "Sheffield city centre" }),
      ).valid,
    ).toBe(true);
  });

  it("rejects a full-postcode-shaped item location label", () => {
    expect(codesOf(snapshot({ items: [providerItem({ locationLabel: "S1 2HH" })] }))).toEqual([
      "unsafe_location_label",
    ]);
  });

  it("rejects a complete postcode embedded anywhere in a label", () => {
    for (const label of [
      "Near CV1 2AB",
      "Coventry (CV1 2AB)",
      "campus, cv12ab, parking",
      "Site GIR 0AA depot",
      "gir0aa",
      "Sheffield S1 2HH area",
    ]) {
      expect(looksLikeFullPostcode(label)).toBe(true);
      expect(codesOf(snapshot({ items: [providerItem({ locationLabel: label })] }))).toEqual([
        "unsafe_location_label",
      ]);
    }
  });

  it("leaves ordinary area labels untouched by the conservative safety check", () => {
    for (const label of [
      "Sheffield",
      "S1",
      "S1 2",
      "Rotherham and Sheffield",
      "SW1A",
      "CV1",
      "CV1 2",
      "Coventry (CV1 2)",
    ]) {
      expect(looksLikeFullPostcode(label)).toBe(false);
    }
  });

  it("allows the label to be omitted", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(
      snapshot({ precisionLevel: "full_postcode", searchAreaLabel: null }),
    );
    expect(parsed.searchAreaLabel).toBeNull();
  });
});

describe("bounded participant-facing details", () => {
  it("rejects more than the bounded maximum", () => {
    const details = Array.from({ length: MAX_ITEM_DETAILS + 1 }, (_, index) => ({
      detailKey: `detail.${index}`,
      detailText: "value",
    }));
    expect(codesOf(snapshot({ items: [providerItem({ details })] }))).toEqual(["schema_invalid"]);
  });

  it("rejects duplicate detail keys", () => {
    expect(
      codesOf(
        snapshot({
          items: [
            providerItem({
              details: [
                { detailKey: "study.mode", detailText: "Day release" },
                { detailKey: "study.mode", detailText: "Evening" },
              ],
            }),
          ],
        }),
      ),
    ).toEqual(["duplicate_detail_key"]);
  });

  it("canonicalises non-semantic detail order deterministically", () => {
    const ordered = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [programmeItem()] }),
    ).items[0]!.details.map((detail) => detail.detailKey);
    const reversed = parseCanonicalLocalRealitySnapshot(
      snapshot({
        items: [programmeItem({ details: [...programmeItem().details].reverse() })],
      }),
    ).items[0]!.details.map((detail) => detail.detailKey);
    expect(ordered).toEqual(["duration", "study.mode"]);
    expect(reversed).toEqual(ordered);
  });

  it("canonicalises non-semantic item order deterministically", () => {
    const forward = parseCanonicalLocalRealitySnapshot(snapshot()).items.map((i) => i.itemId);
    const backward = parseCanonicalLocalRealitySnapshot(
      snapshot({ items: [opportunityItem(), programmeItem(), providerItem()] }),
    ).items.map((i) => i.itemId);
    expect(backward).toEqual(forward);
  });
});

describe("immutability", () => {
  it("deep-freezes the whole document", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(snapshot());
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.items)).toBe(true);
    expect(Object.isFrozen(parsed.items[0])).toBe(true);
    expect(() => {
      (parsed as { snapshotId: string }).snapshotId = "x";
    }).toThrow();
  });

  it("freezes descendants of an already-frozen parent", () => {
    const input = snapshot();
    Object.freeze(input);
    Object.freeze(input.items);
    const parsed = parseCanonicalLocalRealitySnapshot(input);
    expect(Object.isFrozen(parsed.items[0]!.details)).toBe(true);
  });

  it("does not mutate the caller's input object", () => {
    const input = snapshot({ items: [programmeItem(), providerItem()] });
    const before = JSON.stringify(input);
    parseCanonicalLocalRealitySnapshot(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects cyclic input rather than looping", () => {
    const cyclic = snapshot() as Record<string, unknown>;
    cyclic["self"] = cyclic;
    const outcome = safeParseCanonicalLocalRealitySnapshot(cyclic);
    expect(outcome.ok).toBe(false);
  });

  it("fails closed with a typed error", () => {
    expect(() => parseCanonicalLocalRealitySnapshot({})).toThrow(
      /invalid canonical Local Reality snapshot/,
    );
  });
});

describe("snapshot document scope", () => {
  it("carries no self content hash and no conclusion fields", () => {
    const parsed: LocalRealitySnapshot = parseCanonicalLocalRealitySnapshot(snapshot());
    const keys = Object.keys(parsed);
    expect(keys).not.toContain("contentHash");
    for (const key of ["accessibility", "judgement", "eligibility", "demand", "postcode"]) {
      expect(keys.some((candidate) => candidate.toLowerCase().includes(key))).toBe(false);
    }
  });
});
