import { canonicalJsonStringify } from "../career-pack-governance/canonical-json";
import { hashCanonicalCareerPack, sha256Hex } from "../career-pack-governance/hash";
import type { CareerPack } from "../career-packs";
import type { PinnedVersionedRef, SnapshotRef } from "../contracts";
import type { QuestionRef } from "../questions";

/**
 * Shared canonicalisation, hashing and immutability boundary for assessment
 * input artefacts.
 *
 * The already-present deterministic canonical JSON + SHA-256 implementation from
 * Career Pack governance is REUSED. No second serialisation format, hashing
 * algorithm or dependency is introduced.
 */

/**
 * Runtime immutability boundary: mutation through casts cannot change hashes.
 *
 * A parent that is ALREADY frozen must still be traversed: `Object.freeze` is
 * shallow, so an early return on a shallow-frozen parent would leave nested
 * children mutable. Only null, primitives and revisits terminate the walk.
 *
 * Cycle tracking is private to this module: callers cannot pre-populate it and
 * skip traversal/freezing of a root or descendant.
 */
function deepFreeze<T>(value: T, visited: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (visited.has(value)) return value;
  visited.add(value);
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key], visited);
  }
  return value;
}

export function deepFreezeDocument<T>(value: T): T {
  return deepFreeze(value, new WeakSet<object>());
}

/**
 * Collision-free canonical ordering key for a full question identity tuple.
 *
 * Deterministic JSON tuple encoding is used deliberately so ordering relies on
 * no delimiter-character assumption about `questionKey`.
 */
export function questionIdentityKey(ref: QuestionRef): string {
  return JSON.stringify([ref.moduleCode, ref.questionKey]);
}

/** Collision-free canonical ordering key for a Career Pack evidence key. */
export function evidenceEntryKey(evidenceKey: string): string {
  return JSON.stringify([evidenceKey]);
}

/** Total, stable code-unit ordering over canonical tuple-encoded keys. */
export function compareCanonicalKeys(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Exact pinned Career Pack reference derived from canonical truth.
 *
 * A caller-supplied content hash is never an input here: the hash is always
 * recomputed from the canonical pack document.
 */
export function pinnedCareerPackRef(pack: CareerPack): PinnedVersionedRef {
  return Object.freeze({
    id: pack.careerPackId,
    version: pack.version,
    contentHash: hashCanonicalCareerPack(pack),
  });
}

/** True when two pinned references pin exactly the same artefact state. */
export function pinnedRefsEqual(left: PinnedVersionedRef, right: PinnedVersionedRef): boolean {
  return (
    left.id === right.id && left.version === right.version && left.contentHash === right.contentHash
  );
}

/** Deterministic SHA-256 content hash of a canonical, finalised document. */
export function contentHashOfCanonicalDocument(document: unknown): string {
  return sha256Hex(canonicalJsonStringify(document));
}

/** Derive the existing `SnapshotRef` shape from a canonical snapshot document. */
export function snapshotRefOfDocument(document: { readonly snapshotId: string }): SnapshotRef {
  return Object.freeze({
    id: document.snapshotId,
    contentHash: contentHashOfCanonicalDocument(document),
  });
}
