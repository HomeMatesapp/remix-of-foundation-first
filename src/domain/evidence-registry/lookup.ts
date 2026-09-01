import {
  evidenceIdentityKey,
  evidenceRevisionKey,
  type EvidenceRecordIdentity,
  type EvidenceRecordRevision,
  type EvidenceRecordRevisionRef,
  type EvidenceRegistry,
  type EvidenceSourceDefinition,
} from "./schema";

/**
 * Pure deterministic lookup over a canonical (already validated) registry.
 *
 * Selection is derived from explicit supersession lineage ONLY. Array order and
 * wall-clock time never decide which revision is current.
 */

export function findEvidenceSource(
  registry: EvidenceRegistry,
  sourceId: string,
): EvidenceSourceDefinition | null {
  return registry.sources.find((source) => source.sourceId === sourceId) ?? null;
}

export function findEvidenceSourceByKey(
  registry: EvidenceRegistry,
  sourceKey: string,
): EvidenceSourceDefinition | null {
  return registry.sources.find((source) => source.sourceKey === sourceKey) ?? null;
}

/** All revisions of one source-record identity, in unspecified storage order. */
export function collectRecordRevisions(
  registry: EvidenceRegistry,
  identity: EvidenceRecordIdentity,
): readonly EvidenceRecordRevision[] {
  const key = evidenceIdentityKey(identity);
  return registry.records.filter((record) => evidenceIdentityKey(record) === key);
}

/**
 * Exact revision lookup. A withdrawn or superseded revision is STILL resolvable
 * here: history is never hidden.
 */
export function findExactRecordRevision(
  registry: EvidenceRegistry,
  ref: EvidenceRecordRevisionRef,
): EvidenceRecordRevision | null {
  const key = evidenceRevisionKey(ref);
  return registry.records.find((record) => evidenceRevisionKey(record) === key) ?? null;
}

/**
 * Full lineage ordered root -> terminal, reconstructed by walking explicit
 * supersession links backwards from the terminal revision. Returns an empty
 * array when the identity is unknown, and `null` when the lineage is not a
 * single determinable chain.
 */
export function resolveRecordLineage(
  registry: EvidenceRegistry,
  identity: EvidenceRecordIdentity,
): readonly EvidenceRecordRevision[] | null {
  const revisions = collectRecordRevisions(registry, identity);
  if (revisions.length === 0) return [];

  const superseded = new Set<string>();
  for (const revision of revisions) {
    if (revision.supersedes) superseded.add(evidenceRevisionKey(revision.supersedes));
  }
  const terminals = revisions.filter((revision) => !superseded.has(evidenceRevisionKey(revision)));
  if (terminals.length !== 1) return null;

  const chain: EvidenceRecordRevision[] = [];
  const seen = new Set<string>();
  let cursor: EvidenceRecordRevision | undefined = terminals[0]!;
  while (cursor) {
    const key = evidenceRevisionKey(cursor);
    if (seen.has(key)) return null;
    seen.add(key);
    chain.push(cursor);
    if (!cursor.supersedes) break;
    cursor = findExactRecordRevision(registry, cursor.supersedes) ?? undefined;
  }
  if (chain.length !== revisions.length) return null;
  return chain.reverse();
}

/**
 * Terminal revision of a lineage, whether or not it is withdrawn. `null` when
 * the identity is unknown or the terminal is not uniquely determinable.
 */
export function findTerminalRecordRevision(
  registry: EvidenceRegistry,
  identity: EvidenceRecordIdentity,
): EvidenceRecordRevision | null {
  const lineage = resolveRecordLineage(registry, identity);
  if (!lineage || lineage.length === 0) return null;
  return lineage[lineage.length - 1]!;
}

/**
 * Current USABLE revision: the unique terminal revision, and only when it has
 * not been withdrawn. A withdrawn terminal never masquerades as current
 * evidence, and no earlier revision is silently substituted for it.
 */
export function resolveCurrentUsableRevision(
  registry: EvidenceRegistry,
  identity: EvidenceRecordIdentity,
): EvidenceRecordRevision | null {
  const terminal = findTerminalRecordRevision(registry, identity);
  if (!terminal) return null;
  return terminal.withdrawal ? null : terminal;
}

/** True when this exact revision carries withdrawal metadata. */
export function isRevisionWithdrawn(revision: EvidenceRecordRevision): boolean {
  return Boolean(revision.withdrawal);
}
