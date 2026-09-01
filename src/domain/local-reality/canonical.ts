/**
 * Pure canonicalisation and immutability helpers for Local Reality snapshots.
 *
 * This module is deliberately hash-free and browser-safe: canonical JSON and
 * SHA-256 hashing live in the separate server-authority module `./hash`, which
 * is not re-exported from the package barrel, so the schema surface never ships
 * `node:crypto`.
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

/** Total, stable code-unit ordering over canonical tuple-encoded keys. */
export function compareCanonicalKeys(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Collision-free canonical ordering key for an arbitrary tuple of parts.
 *
 * Deterministic JSON tuple encoding is used deliberately so ordering relies on
 * no delimiter-character assumption about externally owned values such as
 * `sourceRecordKey`, which is preserved byte for byte and never normalised.
 */
export function canonicalTupleKey(parts: readonly string[]): string {
  return JSON.stringify(parts);
}

/**
 * Source-owned stable identity of one snapshotted fact.
 *
 * The frozen live model owns identity uniqueness per object namespace, so the
 * dedupe key is `(objectType, sourceId, sourceRecordKey)`. The typed object UUID
 * is deliberately NOT part of this key: it is a separate exact reference, and the
 * same source record must not be bound to two different typed objects.
 */
export function snapshotItemIdentityKey(item: {
  readonly sourceId: string;
  readonly sourceRecordKey: string;
  readonly objectType: string;
}): string {
  return canonicalTupleKey([item.objectType, item.sourceId, item.sourceRecordKey]);
}

/**
 * Conservative display-safety screening for participant-facing area labels.
 *
 * This is NOT a UK postcode validator and makes no claim to be one. It rejects a
 * label in which a complete UK postcode appears ANYWHERE, case-insensitively and
 * with or without the normal internal space, including the special `GIR 0AA`.
 * Outward and sector-style area labels (`CV1`, `CV1 2`, `SW1A`,
 * `Coventry (CV1 2)`) remain allowed.
 */
const EMBEDDED_FULL_POSTCODE =
  /(?<![A-Z\d])(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})(?![A-Z\d])/i;

export function looksLikeFullPostcode(label: string): boolean {
  return EMBEDDED_FULL_POSTCODE.test(label);
}

/** True when a number carries at most one decimal place. */
export function hasAtMostOneDecimalPlace(value: number): boolean {
  return Number.isFinite(value) && Math.round(value * 10) === value * 10;
}
