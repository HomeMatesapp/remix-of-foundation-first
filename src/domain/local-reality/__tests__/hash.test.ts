import { describe, expect, it } from "vitest";

import { hashCanonicalLocalRealitySnapshot, localRealitySnapshotRef } from "../hash";
import { parseCanonicalLocalRealitySnapshot } from "../schema";
import { SNAPSHOT_ID, opportunityItem, programmeItem, providerItem, snapshot } from "./fixtures";

describe("deterministic snapshot hashing", () => {
  it("produces the same hash for semantically identical canonical inputs", () => {
    const forward = parseCanonicalLocalRealitySnapshot(snapshot());
    const reordered = parseCanonicalLocalRealitySnapshot(
      snapshot({
        items: [
          opportunityItem(),
          providerItem(),
          programmeItem({ details: [...programmeItem().details].reverse() }),
        ],
      }),
    );
    expect(hashCanonicalLocalRealitySnapshot(reordered)).toBe(
      hashCanonicalLocalRealitySnapshot(forward),
    );
  });

  it("changes when a snapshotted fact changes", () => {
    const base = hashCanonicalLocalRealitySnapshot(parseCanonicalLocalRealitySnapshot(snapshot()));
    const changedDistance = hashCanonicalLocalRealitySnapshot(
      parseCanonicalLocalRealitySnapshot(
        snapshot({
          items: [providerItem({ approxDistanceMiles: 3.5 }), programmeItem(), opportunityItem()],
        }),
      ),
    );
    const changedRadius = hashCanonicalLocalRealitySnapshot(
      parseCanonicalLocalRealitySnapshot(snapshot({ approxRadiusMiles: 20 })),
    );
    const changedKey = hashCanonicalLocalRealitySnapshot(
      parseCanonicalLocalRealitySnapshot(
        snapshot({
          items: [
            providerItem({ availabilityConfidenceKey: "source.withdrawn" }),
            programmeItem(),
            opportunityItem(),
          ],
        }),
      ),
    );
    expect(new Set([base, changedDistance, changedRadius, changedKey]).size).toBe(4);
  });

  it("includes the governed signalKey in the canonical hash", () => {
    const base = hashCanonicalLocalRealitySnapshot(parseCanonicalLocalRealitySnapshot(snapshot()));
    const changedSignal = hashCanonicalLocalRealitySnapshot(
      parseCanonicalLocalRealitySnapshot(
        snapshot({
          items: [
            providerItem({ signalKey: "provider.other" }),
            programmeItem(),
            opportunityItem(),
          ],
        }),
      ),
    );
    expect(changedSignal).not.toBe(base);
  });

  it("derives the existing SnapshotRef shape by recomputation", () => {
    const parsed = parseCanonicalLocalRealitySnapshot(snapshot());
    const ref = localRealitySnapshotRef(parsed);
    expect(Object.keys(ref).sort()).toEqual(["contentHash", "id"]);
    expect(ref.id).toBe(SNAPSHOT_ID);
    expect(ref.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.isFrozen(ref)).toBe(true);
  });
});
