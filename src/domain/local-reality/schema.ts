import { z } from "zod";

import {
  isoTimestampSchema,
  nonEmptyTextSchema,
  sourceRecordKeySchema,
  stableKeySchema,
  uuidSchema,
} from "../contracts";
import {
  canonicalTupleKey,
  compareCanonicalKeys,
  deepFreezeDocument,
  hasAtMostOneDecimalPlace,
  looksLikeFullPostcode,
  snapshotItemIdentityKey,
} from "./canonical";
import {
  LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION,
  LOCAL_SNAPSHOT_OBJECT_TYPES,
  LOCATION_PRECISION_LEVELS,
  MAX_DISTANCE_MILES,
  MAX_ITEM_DETAILS,
  MAX_RADIUS_MILES,
  MIN_RADIUS_MILES,
  type LocalRealitySnapshotIssue,
  type LocalRealitySnapshotValidationResult,
  type LocalSnapshotObjectType,
} from "./codes";

/**
 * Canonical immutable Local Reality snapshot document (Stage A).
 *
 * It records the local facts that were established and shown, exactly as they
 * stood, so a historical view can be reconstructed. It carries no raw postcode,
 * no coordinates, no geographic computation, no local-accessibility conclusion,
 * no opportunity-status interpretation, no local labour-demand model, no
 * participant identity and no self-referential content hash.
 *
 * Distances here are already-established approximate facts recorded verbatim;
 * nothing in this package computes distance.
 */

/* -------------------------------------------------------------------------- */
/* Field-level schemas                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Approximate distance in miles, snapshotted from upstream reviewed data.
 * Non-negative, one decimal place maximum, bounded to the approved projection
 * width, never computed here.
 */
export const approxDistanceMilesSchema = z
  .number()
  .nonnegative("must not be negative")
  .max(MAX_DISTANCE_MILES, `must be at most ${MAX_DISTANCE_MILES}`)
  .refine(hasAtMostOneDecimalPlace, "must have at most one decimal place");

/** Approximate search radius in WHOLE miles, bounded 1–100 per the frozen ERD. */
export const approxRadiusMilesSchema = z
  .number()
  .int("must be a whole number of miles")
  .min(MIN_RADIUS_MILES, `must be at least ${MIN_RADIUS_MILES}`)
  .max(MAX_RADIUS_MILES, `must be at most ${MAX_RADIUS_MILES}`);

/** Participant-safe area label. Bounded plain text; never a document blob. */
export const participantSafeLocationLabelSchema = nonEmptyTextSchema.max(120);

/**
 * Local-Reality-specific refinement of the shared source-record key.
 *
 * The shared Increment 2 / Increment 7 contract is deliberately unchanged and
 * remains permissive. Stage A additionally fails closed on U+0000, which the
 * approved `source_record_key text` projection cannot store. The key is still
 * preserved verbatim: nothing normalises, trims or hash-replaces it.
 */
export const localSourceRecordKeySchema = sourceRecordKeySchema.refine(
  (value) => !value.includes("\u0000"),
  "must not contain a NUL (U+0000) character",
);

/**
 * One bounded participant-facing detail already established by upstream
 * reviewed data (for example study mode, duration, closing-date text). Free-form
 * documents and raw text blobs are deliberately impossible here.
 */
export const localSnapshotItemDetailSchema = z
  .object({
    detailKey: stableKeySchema,
    /** Short reviewed display text. Preserved verbatim. */
    detailText: nonEmptyTextSchema.max(160),
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type LocalSnapshotItemDetail = z.infer<typeof localSnapshotItemDetailSchema>;

/* -------------------------------------------------------------------------- */
/* Item schema                                                                */
/* -------------------------------------------------------------------------- */

export const localSnapshotItemSchema = z
  .object({
    itemId: uuidSchema,
    objectType: z.enum(LOCAL_SNAPSHOT_OBJECT_TYPES),
    /**
     * OPAQUE governed signal identity required by the frozen
     * `local_snapshot_item.signal_key` column. It is uninterpreted here: it is
     * not eligibility, not local accessibility and not any Stage B resolution.
     */
    signalKey: stableKeySchema,
    /** Typed references: EXACTLY ONE is populated and must match objectType. */
    providerId: uuidSchema.nullable().optional(),
    programmeId: uuidSchema.nullable().optional(),
    opportunityId: uuidSchema.nullable().optional(),
    /** Source-owned stable identity pair. `sourceRecordKey` is verbatim. */
    sourceId: uuidSchema,
    sourceRecordKey: localSourceRecordKeySchema,
    /** Snapshotted provider or employer name as it stood. Nullable per the ERD. */
    organisationName: nonEmptyTextSchema.max(200).nullable().optional(),
    /** Snapshotted item title as it stood. Nullable per the ERD: never invented. */
    itemTitle: nonEmptyTextSchema.max(200).nullable().optional(),
    occupationId: uuidSchema.nullable().optional(),
    archetypeCode: stableKeySchema.nullable().optional(),
    routeKey: stableKeySchema.nullable().optional(),
    /** Already-established approximate distance fact, not computed here. */
    approxDistanceMiles: approxDistanceMilesSchema.nullable().optional(),
    /**
     * OPAQUE governed availability-confidence key.
     *
     * The frozen ERD names an `availability_confidence` enum but the
     * authoritative documents do not define its members, so no enum is invented
     * here. This key is an uninterpreted governed token: it is NOT proven
     * confidence and carries no ordering or meaning in Stage A. DB projection
     * MUST bind it to the eventual approved enum/vocabulary before migration.
     */
    availabilityConfidenceKey: stableKeySchema,
    /**
     * Participant-safe location label, nullable per the ERD so a remote or
     * unknown-location item is never forced to fabricate one. When present it is
     * screened and must never be a full postcode.
     */
    locationLabel: participantSafeLocationLabelSchema.nullable().optional(),
    details: z.array(localSnapshotItemDetailSchema).max(MAX_ITEM_DETAILS),
    /** When this fact was captured into the snapshot. */
    capturedAt: isoTimestampSchema,
  })
  .strict();
export type LocalSnapshotItem = z.infer<typeof localSnapshotItemSchema>;

/* -------------------------------------------------------------------------- */
/* Document schema                                                            */
/* -------------------------------------------------------------------------- */

export const localRealitySnapshotSchema = z
  .object({
    schemaVersion: z.literal(LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION),
    snapshotId: uuidSchema,
    capturedAt: isoTimestampSchema,
    /** Which precision the underlying collection used. No postcode is stored. */
    precisionLevel: z.enum(LOCATION_PRECISION_LEVELS),
    /** Participant-safe search-area label, kept separate from collection data. */
    searchAreaLabel: participantSafeLocationLabelSchema.nullable().optional(),
    approxRadiusMiles: approxRadiusMilesSchema.nullable().optional(),
    /**
     * Transport-mode assumption ONLY. It records what was assumed; it asserts
     * no travel time, journey feasibility or accessibility conclusion.
     */
    transportModeAssumptionKey: stableKeySchema.nullable().optional(),
    items: z.array(localSnapshotItemSchema),
  })
  .strict();
export type LocalRealitySnapshot = z.infer<typeof localRealitySnapshotSchema>;

/* -------------------------------------------------------------------------- */
/* Typed-reference binding                                                    */
/* -------------------------------------------------------------------------- */

const TYPED_REFERENCE_FIELD: Readonly<Record<LocalSnapshotObjectType, keyof LocalSnapshotItem>> =
  Object.freeze({
    provider: "providerId",
    programme: "programmeId",
    opportunity: "opportunityId",
  });

function typedReferenceOf(
  item: LocalSnapshotItem,
): { readonly ok: true; readonly id: string } | { readonly ok: false; readonly message: string } {
  const populated = (["providerId", "programmeId", "opportunityId"] as const).filter(
    (field) => typeof item[field] === "string",
  );
  if (populated.length !== 1) {
    return {
      ok: false,
      message: "exactly one typed object reference must be populated",
    };
  }
  const expected = TYPED_REFERENCE_FIELD[item.objectType];
  if (populated[0] !== expected) {
    return {
      ok: false,
      message: `objectType ${item.objectType} requires ${String(expected)} to be the populated reference`,
    };
  }
  return { ok: true, id: item[expected] as string };
}

/* -------------------------------------------------------------------------- */
/* Whole-document validation and canonicalisation                             */
/* -------------------------------------------------------------------------- */

interface CanonicalisationOutcome {
  readonly valid: boolean;
  readonly issues: readonly LocalRealitySnapshotIssue[];
  readonly snapshot?: LocalRealitySnapshot;
}

function canonicaliseSnapshot(input: unknown): CanonicalisationOutcome {
  const parsed = localRealitySnapshotSchema.safeParse(input);
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
  const issues: LocalRealitySnapshotIssue[] = [];

  if (
    typeof document.searchAreaLabel === "string" &&
    looksLikeFullPostcode(document.searchAreaLabel)
  ) {
    issues.push({
      code: "unsafe_location_label",
      message:
        "a participant-safe area label must not be a full-postcode-shaped value; supply an area label separately",
      at: "searchAreaLabel",
    });
  }

  const seenItemIds = new Set<string>();
  const seenIdentities = new Set<string>();
  const canonicalItems: LocalSnapshotItem[] = [];
  const orderingKeys = new Map<string, string>();

  document.items.forEach((item, index) => {
    const at = `items.${index}`;

    if (seenItemIds.has(item.itemId)) {
      issues.push({ code: "duplicate_item_id", message: "duplicate snapshot item id", at });
      return;
    }
    seenItemIds.add(item.itemId);

    const typed = typedReferenceOf(item);
    if (!typed.ok) {
      issues.push({ code: "typed_reference_mismatch", message: typed.message, at });
      return;
    }

    const identity = snapshotItemIdentityKey({
      sourceId: item.sourceId,
      sourceRecordKey: item.sourceRecordKey,
      objectType: item.objectType,
    });
    if (seenIdentities.has(identity)) {
      issues.push({
        code: "duplicate_source_identity",
        message:
          "duplicate source-owned identity (objectType, sourceId, sourceRecordKey) within the object namespace",
        at,
      });
      return;
    }
    seenIdentities.add(identity);

    if (typeof item.locationLabel === "string" && looksLikeFullPostcode(item.locationLabel)) {
      issues.push({
        code: "unsafe_location_label",
        message: "a participant-safe location label must not be a full-postcode-shaped value",
        at: `${at}.locationLabel`,
      });
      return;
    }

    const detailKeys = new Set<string>();
    let duplicateDetail = false;
    for (const detail of item.details) {
      if (detailKeys.has(detail.detailKey)) {
        issues.push({
          code: "duplicate_detail_key",
          message: "duplicate participant-facing detail key",
          at: `${at}.details.${detail.detailKey}`,
        });
        duplicateDetail = true;
        break;
      }
      detailKeys.add(detail.detailKey);
    }
    if (duplicateDetail) return;

    // Detail order is non-semantic: canonicalised so equivalent items hash
    // identically. Keys are Clear Routes-owned stable keys.
    const details = [...item.details].sort((left, right) =>
      compareCanonicalKeys(
        canonicalTupleKey([left.detailKey]),
        canonicalTupleKey([right.detailKey]),
      ),
    );

    orderingKeys.set(item.itemId, canonicalTupleKey([identity, item.itemId]));
    canonicalItems.push({ ...item, details });
  });

  if (issues.length > 0) return { valid: false, issues };

  // Item order is non-semantic: the snapshot is a set of established facts.
  canonicalItems.sort((left, right) =>
    compareCanonicalKeys(
      orderingKeys.get(left.itemId) as string,
      orderingKeys.get(right.itemId) as string,
    ),
  );

  return {
    valid: true,
    issues: [],
    snapshot: deepFreezeDocument({ ...document, items: canonicalItems }),
  };
}

export class LocalRealitySnapshotValidationError extends Error {
  readonly issues: readonly LocalRealitySnapshotIssue[];

  constructor(issues: readonly LocalRealitySnapshotIssue[]) {
    super(
      `invalid canonical Local Reality snapshot: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "LocalRealitySnapshotValidationError";
    this.issues = issues;
  }
}

/** Structural whole-document validation. Never mutates the input. */
export function validateLocalRealitySnapshot(input: unknown): LocalRealitySnapshotValidationResult {
  const outcome = canonicaliseSnapshot(input);
  return { valid: outcome.valid, issues: outcome.issues };
}

/** Strict-parse, validate, canonicalise order and deep-freeze. Fails closed. */
export function parseCanonicalLocalRealitySnapshot(input: unknown): LocalRealitySnapshot {
  const outcome = canonicaliseSnapshot(input);
  if (!outcome.snapshot) throw new LocalRealitySnapshotValidationError(outcome.issues);
  return outcome.snapshot;
}

/** Non-throwing variant. */
export function safeParseCanonicalLocalRealitySnapshot(
  input: unknown,
):
  | { readonly ok: true; readonly snapshot: LocalRealitySnapshot }
  | { readonly ok: false; readonly issues: readonly LocalRealitySnapshotIssue[] } {
  const outcome = canonicaliseSnapshot(input);
  if (!outcome.snapshot) return { ok: false, issues: outcome.issues };
  return { ok: true, snapshot: outcome.snapshot };
}
