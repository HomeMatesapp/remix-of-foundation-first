import {
  deterministicProvenanceSchema,
  type DeterministicProvenance,
  type SnapshotRef,
} from "../contracts";
import { answerSnapshotRef, type AnswerSnapshot } from "./answer-snapshot";
import { deepFreezeDocument, pinnedRefsEqual } from "./canonical";
import { evidenceContextSnapshotRef, type EvidenceContextSnapshot } from "./evidence-context";
import type { AssessmentProvenanceIssue } from "./codes";

/**
 * Structural assembly of the EXISTING `deterministicProvenanceSchema`.
 *
 * No competing provenance vocabulary, manifest or envelope is introduced. This
 * helper runs no engine, infers no result and knows nothing about Local Reality
 * beyond the already-approved opaque `SnapshotRef`.
 */

export function buildDeterministicProvenance(args: {
  readonly answerSnapshot: AnswerSnapshot;
  readonly evidenceContext: EvidenceContextSnapshot;
  /** Supplied by the caller. No engine version constant exists yet. */
  readonly decisionEngineVersion: string;
  readonly evaluatedAt: string;
  /** Opaque reference only when Local Reality inputs were used. */
  readonly localSnapshot?: SnapshotRef | null;
}):
  | { readonly ok: true; readonly provenance: DeterministicProvenance }
  | { readonly ok: false; readonly issues: readonly AssessmentProvenanceIssue[] } {
  const pack = args.answerSnapshot.careerPack;
  if (!pinnedRefsEqual(pack, args.evidenceContext.careerPack)) {
    return {
      ok: false,
      issues: [
        {
          code: "career_pack_binding_mismatch",
          message:
            "answer snapshot and evidence context snapshot do not bind to the same exact Career Pack",
          at: "careerPack",
        },
      ],
    };
  }

  const candidate: Record<string, unknown> = {
    careerPackId: pack.id,
    careerPackVersion: pack.version,
    careerPackContentHash: pack.contentHash,
    decisionEngineVersion: args.decisionEngineVersion,
    answerSnapshot: answerSnapshotRef(args.answerSnapshot),
    evidenceContext: evidenceContextSnapshotRef(args.evidenceContext),
    evaluatedAt: args.evaluatedAt,
  };
  if (args.localSnapshot !== undefined) candidate["localSnapshot"] = args.localSnapshot;

  const parsed = deterministicProvenanceSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "provenance_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }
  return { ok: true, provenance: deepFreezeDocument(parsed.data) };
}

/** Strict-parse and deep-freeze an existing deterministic provenance envelope. */
export function parseDeterministicProvenance(input: unknown): DeterministicProvenance {
  return deepFreezeDocument(deterministicProvenanceSchema.parse(input));
}
