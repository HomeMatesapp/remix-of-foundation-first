import { z } from "zod";

import type { CareerPack } from "../career-packs";
import {
  pinnedVersionedRefSchema,
  stableKeySchema,
  uuidSchema,
  type SnapshotRef,
} from "../contracts";
import {
  evidenceRecordRevisionSchema,
  resolveEvidenceReference,
  type EvidenceRegistry,
} from "../evidence-registry";
import {
  compareCanonicalKeys,
  contentHashOfCanonicalDocument,
  deepFreezeDocument,
  evidenceEntryKey,
  pinnedCareerPackRef,
  pinnedRefsEqual,
  snapshotRefOfDocument,
} from "./canonical";
import {
  EVIDENCE_CONTEXT_SCHEMA_VERSION,
  type EvidenceContextIssue,
  type EvidenceContextValidationResult,
} from "./codes";
import { evidenceBindingMismatches } from "./reference-binding";

/**
 * Canonical Evidence Context Snapshot document.
 *
 * It binds to the exact Career Pack and embeds the exact immutable Evidence
 * Registry revision state supplied to evaluation, so later registry changes can
 * never rewrite historical assessment input state.
 *
 * There is deliberately no participant-facing evidence copy, raw source
 * document, URL, provider metadata, ingestion metadata or new source vocabulary
 * here.
 */

export const evidenceContextEntrySchema = z
  .object({
    /** The Career Pack's stable evidence key. Mapping is preserved exactly. */
    evidenceKey: stableKeySchema,
    /** Exact resolved immutable Evidence Registry revision. */
    revision: evidenceRecordRevisionSchema,
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type EvidenceContextEntry = z.infer<typeof evidenceContextEntrySchema>;

export const evidenceContextSnapshotSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CONTEXT_SCHEMA_VERSION),
    snapshotId: uuidSchema,
    careerPack: pinnedVersionedRefSchema,
    entries: z.array(evidenceContextEntrySchema),
  })
  .strict();
export type EvidenceContextSnapshot = z.infer<typeof evidenceContextSnapshotSchema>;

/* -------------------------------------------------------------------------- */
/* Canonicalisation and structural validation                                 */
/* -------------------------------------------------------------------------- */

interface CanonicalisationOutcome {
  readonly valid: boolean;
  readonly issues: readonly EvidenceContextIssue[];
  readonly snapshot?: EvidenceContextSnapshot;
}

function canonicaliseEvidenceContext(input: unknown, pack: CareerPack): CanonicalisationOutcome {
  const parsed = evidenceContextSnapshotSchema.safeParse(input);
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
  const document = parsed.data;
  const issues: EvidenceContextIssue[] = [];

  const expected = pinnedCareerPackRef(pack);
  if (!pinnedRefsEqual(document.careerPack, expected)) {
    issues.push({
      code: "career_pack_binding_mismatch",
      message:
        "snapshot Career Pack id, version or content hash does not match the exact canonical Career Pack",
      at: "careerPack",
    });
  }

  const declarations = new Map(pack.evidence.map((entry) => [entry.evidenceKey, entry.reference]));
  const required = new Set(declarations.keys());
  const seen = new Set<string>();
  document.entries.forEach((entry) => {
    if (seen.has(entry.evidenceKey)) {
      issues.push({
        code: "duplicate_evidence_entry",
        message: "duplicate evidence context entry",
        at: entry.evidenceKey,
      });
      return;
    }
    seen.add(entry.evidenceKey);
    const reference = declarations.get(entry.evidenceKey);
    if (!reference) {
      issues.push({
        code: "unknown_evidence_entry",
        message: "entry evidenceKey is not declared by the Career Pack",
        at: entry.evidenceKey,
      });
      return;
    }
    // Historical binding is checked against the pinned Career Pack reference and
    // the embedded revision ONLY: the current registry is never consulted.
    const mismatches = evidenceBindingMismatches(reference, entry.revision);
    if (mismatches.length > 0) {
      issues.push({
        code: "evidence_revision_reference_mismatch",
        message: `embedded revision does not satisfy the Career Pack evidence reference (${mismatches.join(", ")})`,
        at: entry.evidenceKey,
      });
    }
  });

  for (const evidenceKey of required) {
    if (!seen.has(evidenceKey)) {
      issues.push({
        code: "missing_evidence_entry",
        message: "Career Pack evidenceKey has no evidence context entry",
        at: evidenceKey,
      });
    }
  }

  if (issues.length > 0) return { valid: false, issues };

  const canonicalEntries = [...document.entries].sort((left, right) =>
    compareCanonicalKeys(evidenceEntryKey(left.evidenceKey), evidenceEntryKey(right.evidenceKey)),
  );

  return {
    valid: true,
    issues: [],
    snapshot: deepFreezeDocument({
      schemaVersion: document.schemaVersion,
      snapshotId: document.snapshotId,
      careerPack: { ...expected },
      entries: canonicalEntries,
    }),
  };
}

export class EvidenceContextValidationError extends Error {
  readonly issues: readonly EvidenceContextIssue[];

  constructor(issues: readonly EvidenceContextIssue[]) {
    super(
      `invalid canonical Evidence Context Snapshot: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "EvidenceContextValidationError";
    this.issues = issues;
  }
}

/**
 * Structural validation of a SUPPLIED document against the exact Career Pack.
 *
 * A historical snapshot may legitimately embed a revision that has since been
 * withdrawn: history stays reconstructable. Refusing a withdrawn revision as NEW
 * current input is the builder's job below.
 */
export function validateEvidenceContextSnapshot(
  input: unknown,
  pack: CareerPack,
): EvidenceContextValidationResult {
  const outcome = canonicaliseEvidenceContext(input, pack);
  return { valid: outcome.valid, issues: outcome.issues };
}

/** Strict-parse, validate coverage, canonicalise order and deep-freeze. */
export function parseCanonicalEvidenceContextSnapshot(
  input: unknown,
  pack: CareerPack,
): EvidenceContextSnapshot {
  const outcome = canonicaliseEvidenceContext(input, pack);
  if (!outcome.snapshot) throw new EvidenceContextValidationError(outcome.issues);
  return outcome.snapshot;
}

/** Non-throwing variant. */
export function safeParseCanonicalEvidenceContextSnapshot(
  input: unknown,
  pack: CareerPack,
):
  | { readonly ok: true; readonly snapshot: EvidenceContextSnapshot }
  | { readonly ok: false; readonly issues: readonly EvidenceContextIssue[] } {
  const outcome = canonicaliseEvidenceContext(input, pack);
  if (!outcome.snapshot) return { ok: false, issues: outcome.issues };
  return { ok: true, snapshot: outcome.snapshot };
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build a canonical Evidence Context Snapshot for a NEW assessment context.
 *
 * Every Career Pack evidence reference is resolved with Increment 7 resolution
 * semantics and fails closed when unresolved or contradictory. A withdrawn
 * revision never becomes usable current input, even when the pack pins it: that
 * is the existing Increment 7 rule, not a new one. `reviewDueAt` having passed is
 * NOT a rejection reason here.
 */
export function createEvidenceContextSnapshot(args: {
  readonly snapshotId: string;
  readonly pack: CareerPack;
  readonly registry: EvidenceRegistry;
}):
  | { readonly ok: true; readonly snapshot: EvidenceContextSnapshot }
  | { readonly ok: false; readonly issues: readonly EvidenceContextIssue[] } {
  const issues: EvidenceContextIssue[] = [];
  const entries: { readonly evidenceKey: string; readonly revision: unknown }[] = [];

  for (const entry of args.pack.evidence) {
    const resolution = resolveEvidenceReference(args.registry, entry.reference);
    if (!resolution.ok) {
      for (const issue of resolution.issues) {
        issues.push({
          code: "evidence_reference_unresolved",
          message: `${issue.code}: ${issue.message}`,
          at: entry.evidenceKey,
        });
      }
      continue;
    }
    if (resolution.revision.withdrawal) {
      issues.push({
        code: "withdrawn_revision_not_usable",
        message:
          "a withdrawn revision remains historically resolvable but is never usable current evidence",
        at: entry.evidenceKey,
      });
      continue;
    }
    entries.push({ evidenceKey: entry.evidenceKey, revision: resolution.revision });
  }

  if (issues.length > 0) return { ok: false, issues };

  return safeParseCanonicalEvidenceContextSnapshot(
    {
      schemaVersion: EVIDENCE_CONTEXT_SCHEMA_VERSION,
      snapshotId: args.snapshotId,
      careerPack: pinnedCareerPackRef(args.pack),
      // Re-parsed by the canonical boundary, so the finalised document holds its
      // own frozen copy and never aliases caller/registry objects.
      entries,
    },
    args.pack,
  );
}

/** Deterministic content hash of the canonical finalised document. */
export function hashCanonicalEvidenceContextSnapshot(snapshot: EvidenceContextSnapshot): string {
  return contentHashOfCanonicalDocument(snapshot);
}

/** Existing `SnapshotRef` shape `{ id: snapshotId, contentHash }`. */
export function evidenceContextSnapshotRef(snapshot: EvidenceContextSnapshot): SnapshotRef {
  return snapshotRefOfDocument(snapshot);
}
