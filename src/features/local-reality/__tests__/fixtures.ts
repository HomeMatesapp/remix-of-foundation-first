import { parseCanonicalLocalRealitySnapshot } from "../../../domain/local-reality/schema";
import { LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION } from "../../../domain/local-reality/codes";

/**
 * SYNTHETIC canonical snapshots for deterministic Stage C tests only.
 *
 * These exist purely so the UI layer can be proven. Production content supplies
 * nothing here: no fabricated provider, employer, course or vacancy reaches any
 * participant-facing route in this build stage.
 */

export const SNAPSHOT_ID = "6c6f6361-6c63-4000-8000-000000000001";
export const SOURCE_ID = "6c6f6361-6c63-4000-8000-0000000000a1";
export const MATCHING_PROGRAMME_ITEM_ID = "6c6f6361-6c63-4000-8000-000000000101";
export const OTHER_PROGRAMME_ITEM_ID = "6c6f6361-6c63-4000-8000-000000000102";
export const PROGRAMME_ID = "6c6f6361-6c63-4000-8000-000000000201";
export const OTHER_PROGRAMME_ID = "6c6f6361-6c63-4000-8000-000000000202";

/** The REAL Registered Nurse declared local fact key. */
export const RN_LOCAL_FACT_KEY = "local_fact.nmc_approved_programme_access";

export function matchingItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: MATCHING_PROGRAMME_ITEM_ID,
    objectType: "programme",
    signalKey: RN_LOCAL_FACT_KEY,
    programmeId: PROGRAMME_ID,
    sourceId: SOURCE_ID,
    sourceRecordKey: "SYNTH/PROG/0001",
    organisationName: "Synthetic Test University",
    itemTitle: "Synthetic pre-registration nursing programme",
    approxDistanceMiles: 7.5,
    availabilityConfidenceKey: "synthetic.listed",
    locationLabel: "Synthetic Area",
    details: [{ detailKey: "study.mode", detailText: "Full time" }],
    capturedAt: "2026-08-27T09:00:00Z",
    ...overrides,
  };
}

/** A near-miss / undeclared signal that must never match. */
export function nearMissItem(overrides: Record<string, unknown> = {}) {
  return {
    itemId: OTHER_PROGRAMME_ITEM_ID,
    objectType: "programme",
    signalKey: "local_fact.nmc_approved_programme_acces",
    programmeId: OTHER_PROGRAMME_ID,
    sourceId: SOURCE_ID,
    sourceRecordKey: "SYNTH/PROG/0002",
    organisationName: "Synthetic Other College",
    itemTitle: "Synthetic unrelated programme",
    approxDistanceMiles: 1,
    availabilityConfidenceKey: "synthetic.unverified",
    locationLabel: "Synthetic Other Area",
    details: [],
    capturedAt: "2026-08-27T09:00:00Z",
    ...overrides,
  };
}

export function syntheticSnapshot(overrides: Record<string, unknown> = {}) {
  return parseCanonicalLocalRealitySnapshot({
    schemaVersion: LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: SNAPSHOT_ID,
    capturedAt: "2026-08-27T09:00:00Z",
    precisionLevel: "full_postcode",
    searchAreaLabel: "Synthetic Area",
    approxRadiusMiles: 25,
    items: [matchingItem()],
    ...overrides,
  });
}
