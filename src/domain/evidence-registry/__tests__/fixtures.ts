import { EVIDENCE_REGISTRY_SCHEMA_VERSION } from "../codes";

/** Deterministic 64-character lowercase hex digest from a short hex label. */
export function hex(label: string): string {
  return label.padEnd(64, "0");
}

export const SOURCE_A_ID = "11111111-1111-4111-8111-111111111111";
export const SOURCE_B_ID = "22222222-2222-4222-8222-222222222222";
export const UNKNOWN_SOURCE_ID = "33333333-3333-4333-8333-333333333333";

export const RECORD_KEY = "ofqual/level-3-diploma?ref=600/1234/5";
export const OTHER_RECORD_KEY = "ofqual/level-2-award?ref=600/9999/1";

export const SOURCE_A = { sourceId: SOURCE_A_ID, sourceKey: "source.ofqual" };
export const SOURCE_B = { sourceId: SOURCE_B_ID, sourceKey: "source.ucas" };

export interface RevisionOverrides {
  readonly sourceId?: string;
  readonly sourceRecordKey?: string;
  readonly recordVersion?: string;
  readonly recordContentHash?: string;
  readonly grade?: string;
  readonly participantClassification?: string;
  readonly retrievedAt?: string;
  readonly reviewDueAt?: string | null;
  readonly supersedes?: unknown;
  readonly withdrawal?: unknown;
}

/** Base canonical revision, overridable field by field. */
export function revision(overrides: RevisionOverrides = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    sourceId: SOURCE_A_ID,
    sourceRecordKey: RECORD_KEY,
    recordVersion: "1.0.0",
    recordContentHash: hex("a1"),
    grade: "B",
    participantClassification: "provider_dependent",
    retrievedAt: "2026-01-01T00:00:00Z",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    base[key] = value;
  }
  return base;
}

/** Pinned reference to an exact revision. */
export function ref(
  recordVersion: string,
  recordContentHash: string,
  identity: { sourceId?: string; sourceRecordKey?: string } = {},
): Record<string, unknown> {
  return {
    sourceId: identity.sourceId ?? SOURCE_A_ID,
    sourceRecordKey: identity.sourceRecordKey ?? RECORD_KEY,
    recordVersion,
    recordContentHash,
  };
}

export function registry(
  records: readonly unknown[],
  sources: readonly unknown[] = [SOURCE_A, SOURCE_B],
): Record<string, unknown> {
  return {
    registryVersion: EVIDENCE_REGISTRY_SCHEMA_VERSION,
    sources: [...sources],
    records: [...records],
  };
}

/** A valid two-step lineage: 1.0.0 -> 2.0.0, terminal is 2.0.0. */
export function lineageRegistry(): Record<string, unknown> {
  return registry([
    revision(),
    revision({
      recordVersion: "2.0.0",
      recordContentHash: hex("b2"),
      retrievedAt: "2026-02-01T00:00:00Z",
      supersedes: ref("1.0.0", hex("a1")),
    }),
  ]);
}
