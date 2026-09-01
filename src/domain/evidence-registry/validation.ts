import {
  isStrictlyGreaterVersion,
  compareSemanticVersionPrecedence,
} from "../career-pack-governance/semver";
import {
  EVIDENCE_REGISTRY_SCHEMA_VERSION,
  type EvidenceRegistryIssue,
  type EvidenceRegistryValidationResult,
} from "./codes";
import {
  evidenceIdentityKey,
  evidenceRegistrySchema,
  evidenceRevisionKey,
  evidenceIdentitySlotKey,
  formatEvidenceRecordIdentity,
  formatEvidenceRevisionAddress,
  type EvidenceRecordRevision,
  type EvidenceRegistry,
} from "./schema";

/**
 * Pure whole-registry integrity validation. It fails CLOSED: an ambiguous,
 * contradictory or incomplete lineage is an error, never a cue to guess a
 * convenient record.
 *
 * Nothing here produces judgement, eligibility or strength promotion. Grades
 * and participant classifications are read exactly as stored.
 */

function push(
  issues: EvidenceRegistryIssue[],
  code: EvidenceRegistryIssue["code"],
  message: string,
  at?: string,
): void {
  issues.push(at === undefined ? { code, message } : { code, message, at });
}

export function validateEvidenceRegistry(input: unknown): EvidenceRegistryValidationResult {
  const parsed = evidenceRegistrySchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }
  const registry: EvidenceRegistry = parsed.data;
  const issues: EvidenceRegistryIssue[] = [];

  /* ---------------------------------------------------------------------- */
  /* Source identity                                                        */
  /* ---------------------------------------------------------------------- */

  const sourceIds = new Set<string>();
  const sourceKeys = new Set<string>();
  for (const source of registry.sources) {
    if (sourceIds.has(source.sourceId)) {
      push(issues, "duplicate_source_id", "sourceId must be unique", source.sourceId);
    }
    sourceIds.add(source.sourceId);
    if (sourceKeys.has(source.sourceKey)) {
      push(issues, "duplicate_source_key", "sourceKey must be unique", source.sourceKey);
    }
    sourceKeys.add(source.sourceKey);
  }

  /* ---------------------------------------------------------------------- */
  /* Revision identity and content-hash coherence                           */
  /* ---------------------------------------------------------------------- */

  const byRevisionKey = new Map<string, EvidenceRecordRevision>();
  const versionToHash = new Map<string, string>();
  const hashToVersion = new Map<string, string>();
  const byIdentity = new Map<string, EvidenceRecordRevision[]>();

  for (const record of registry.records) {
    const address = formatEvidenceRevisionAddress(record);
    if (!sourceIds.has(record.sourceId)) {
      push(issues, "unknown_source", "record references an undeclared sourceId", address);
    }

    const key = evidenceRevisionKey(record);
    if (byRevisionKey.has(key)) {
      push(issues, "duplicate_revision", "exact record revision is declared twice", address);
    } else {
      byRevisionKey.set(key, record);
    }

    const versionSlot = evidenceIdentitySlotKey(record, record.recordVersion);
    const knownHash = versionToHash.get(versionSlot);
    if (knownHash !== undefined && knownHash !== record.recordContentHash) {
      push(
        issues,
        "content_hash_conflict",
        "the same record version declares two different content hashes",
        address,
      );
    } else {
      versionToHash.set(versionSlot, record.recordContentHash);
    }

    const hashSlot = evidenceIdentitySlotKey(record, record.recordContentHash);
    const knownVersion = hashToVersion.get(hashSlot);
    if (knownVersion !== undefined && knownVersion !== record.recordVersion) {
      push(
        issues,
        "content_hash_conflict",
        "identical content is declared under two different record versions",
        address,
      );
    } else {
      hashToVersion.set(hashSlot, record.recordVersion);
    }

    const identity = evidenceIdentityKey(record);
    const bucket = byIdentity.get(identity);
    if (bucket) bucket.push(record);
    else byIdentity.set(identity, [record]);
  }

  /* ---------------------------------------------------------------------- */
  /* Supersession lineage                                                   */
  /* ---------------------------------------------------------------------- */

  const successorsOf = new Map<string, EvidenceRecordRevision[]>();
  const brokenIdentities = new Set<string>();

  for (const record of registry.records) {
    const prior = record.supersedes;
    if (!prior) continue;
    const address = formatEvidenceRevisionAddress(record);
    const identity = evidenceIdentityKey(record);

    if (prior.sourceId !== record.sourceId || prior.sourceRecordKey !== record.sourceRecordKey) {
      push(
        issues,
        "supersedes_identity_mismatch",
        "a revision may only supersede a prior revision of the same source-record identity",
        address,
      );
      brokenIdentities.add(identity);
      continue;
    }

    const priorKey = evidenceRevisionKey(prior);
    if (!byRevisionKey.has(priorKey)) {
      push(
        issues,
        "unknown_supersedes_target",
        `superseded revision is not present in the registry: ${formatEvidenceRevisionAddress(prior)}`,
        address,
      );
      brokenIdentities.add(identity);
      continue;
    }

    if (compareSemanticVersionPrecedence(record.recordVersion, prior.recordVersion) === 0) {
      // Same version, different hash: already a content-hash conflict upstream,
      // and never a valid supersession step.
      push(
        issues,
        "supersedes_version_not_greater",
        "a superseding revision must have strictly greater semantic version precedence",
        address,
      );
      brokenIdentities.add(identity);
      continue;
    }
    if (!isStrictlyGreaterVersion(record.recordVersion, prior.recordVersion)) {
      push(
        issues,
        "supersedes_version_not_greater",
        "a superseding revision must have strictly greater semantic version precedence",
        address,
      );
      brokenIdentities.add(identity);
      continue;
    }

    const successors = successorsOf.get(priorKey);
    if (successors) successors.push(record);
    else successorsOf.set(priorKey, [record]);
  }

  for (const [priorKey, successors] of successorsOf) {
    if (successors.length > 1) {
      const first = successors[0]!;
      push(
        issues,
        "supersession_branch",
        `exactly one revision may supersede a given prior revision; found ${successors.length}`,
        formatEvidenceRevisionAddress(byRevisionKey.get(priorKey) ?? first),
      );
      brokenIdentities.add(evidenceIdentityKey(first));
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Per-identity lineage must be exactly one connected, acyclic chain      */
  /* ---------------------------------------------------------------------- */

  for (const [identity, records] of byIdentity) {
    if (brokenIdentities.has(identity)) continue;
    const at = formatEvidenceRecordIdentity(records[0]!);

    // Cycle detection walks backwards along explicit supersession links only.
    let cyclic = false;
    for (const record of records) {
      const seen = new Set<string>([evidenceRevisionKey(record)]);
      let cursor: EvidenceRecordRevision | undefined = record;
      while (cursor?.supersedes) {
        const nextKey = evidenceRevisionKey(cursor.supersedes);
        if (seen.has(nextKey)) {
          cyclic = true;
          break;
        }
        seen.add(nextKey);
        cursor = byRevisionKey.get(nextKey);
      }
      if (cyclic) break;
    }
    if (cyclic) {
      push(issues, "supersession_cycle", "supersession lineage contains a cycle", at);
      continue;
    }

    const roots = records.filter((record) => !record.supersedes);
    if (roots.length !== 1) {
      push(
        issues,
        "lineage_ambiguous",
        `a source-record identity must have exactly one root revision; found ${roots.length}`,
        at,
      );
      continue;
    }
    const terminals = records.filter((record) => !successorsOf.has(evidenceRevisionKey(record)));
    if (terminals.length !== 1) {
      push(
        issues,
        "lineage_ambiguous",
        `a source-record identity must have exactly one terminal revision; found ${terminals.length}`,
        at,
      );
      continue;
    }

    // Every revision must lie on the single chain between root and terminal.
    let length = 1;
    let cursor: EvidenceRecordRevision | undefined = terminals[0]!;
    while (cursor?.supersedes) {
      cursor = byRevisionKey.get(evidenceRevisionKey(cursor.supersedes));
      if (!cursor) break;
      length += 1;
    }
    if (length !== records.length) {
      push(
        issues,
        "lineage_ambiguous",
        "every revision of a source-record identity must lie on one connected supersession chain",
        at,
      );
    }
  }

  if (registry.registryVersion !== EVIDENCE_REGISTRY_SCHEMA_VERSION) {
    push(issues, "schema_invalid", "unsupported registryVersion", "registryVersion");
  }

  return { valid: issues.length === 0, issues };
}
