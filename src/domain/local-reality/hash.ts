import { canonicalJsonStringify } from "../career-pack-governance/canonical-json";
import { sha256Hex } from "../career-pack-governance/hash";
import type { SnapshotRef } from "../contracts";
import type { LocalRealitySnapshot } from "./schema";

/**
 * SERVER-AUTHORITY hashing for Local Reality snapshots.
 *
 * Isolated deliberately: this module is NOT re-exported from the package barrel,
 * so the browser-safe schema surface never pulls in `node:crypto` transitively.
 *
 * The already-present deterministic canonical JSON + SHA-256 implementation is
 * REUSED. No second serialisation format, hashing algorithm or dependency is
 * introduced, and the canonical document never carries its own content hash.
 */

/** Deterministic SHA-256 content hash of a canonical snapshot document. */
export function hashCanonicalLocalRealitySnapshot(snapshot: LocalRealitySnapshot): string {
  return sha256Hex(canonicalJsonStringify(snapshot));
}

/**
 * Derive the existing `SnapshotRef` shape from a canonical snapshot document.
 * A caller-supplied hash is never an input: the hash is always recomputed.
 */
export function localRealitySnapshotRef(snapshot: LocalRealitySnapshot): SnapshotRef {
  return Object.freeze({
    id: snapshot.snapshotId,
    contentHash: hashCanonicalLocalRealitySnapshot(snapshot),
  });
}
