import { z } from "zod";

/**
 * Cross-cutting primitive schemas.
 *
 * These are structural validation primitives only. They do not imply database
 * columns, tables or storage of any kind.
 */

/** RFC 4122 UUID (any version), lowercase or uppercase. */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "must be a UUID",
  );
export type Uuid = z.infer<typeof uuidSchema>;

/** Non-empty text, trimmed before validation. */
export const nonEmptyTextSchema = z.string().trim().min(1, "must not be empty");
export type NonEmptyText = z.infer<typeof nonEmptyTextSchema>;

/**
 * ISO 8601 date-time string with an explicit offset or `Z`, compatible with
 * Postgres `timestamptz` round-tripping.
 */
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Pure proleptic-Gregorian calendar-day validity. Leap years are divisible by 4,
 * except centuries, unless divisible by 400 — applied uniformly, including to
 * year 0000 (a leap year under proleptic Gregorian arithmetic).
 */
function isRealCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (lengths[month - 1] as number);
}

export const isoTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/,
    "must be an ISO 8601 timestamp with timezone offset or Z",
  )
  .refine((value) => {
    // `Date.parse` normalises impossible days (2026-02-30 -> 2026-03-02) and
    // therefore cannot enforce the documented "real instant" contract on its
    // own; the calendar check below fails closed instead.
    const match = ISO_TIMESTAMP_PATTERN.exec(value);
    if (!match) return false;
    const [, year, month, day] = match as unknown as [string, string, string, string];
    return isRealCalendarDay(Number(year), Number(month), Number(day));
  }, "must be a real instant")
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be a real instant");

export type IsoTimestamp = z.infer<typeof isoTimestampSchema>;

/** Semantic version `MAJOR.MINOR.PATCH` with optional prerelease/build. */
export const semanticVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
    "must be a semantic version",
  );
export type SemanticVersion = z.infer<typeof semanticVersionSchema>;

/** Lowercase hex SHA-256 digest (64 hex characters). */
export const sha256HashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "must be a lowercase hex SHA-256 digest");
export type Sha256Hash = z.infer<typeof sha256HashSchema>;

/**
 * Stable, Clear Routes-owned internal machine key (requirement keys, route keys,
 * check keys). Deliberately conservative because we mint these ourselves.
 */
export const stableKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:\-/]*$/, "must be a stable key");
export type StableKey = z.infer<typeof stableKeySchema>;

/**
 * External source record identity (`source_record_key`).
 *
 * The frozen architecture pins the identity pair `source_id + source_record_key`;
 * it does NOT pin a character set. External systems may use any legitimate
 * characters, so this schema only requires non-blank text and never normalises
 * or rewrites the external key.
 */
export const sourceRecordKeySchema = z
  .string()
  .refine((value) => value.trim().length > 0, "must not be blank");
export type SourceRecordKey = z.infer<typeof sourceRecordKeySchema>;

/**
 * Reference to an immutable, versioned artefact.
 *
 * `id` identifies the artefact lineage; `version` and/or `contentHash` pin the
 * exact immutable state. Which of the two are required is decided by the
 * consuming contract, not here.
 */
export const versionedRefSchema = z
  .object({
    id: uuidSchema,
    version: semanticVersionSchema.nullable().optional(),
    contentHash: sha256HashSchema.nullable().optional(),
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type VersionedRef = z.infer<typeof versionedRefSchema>;

/** A versioned reference that must carry both version and content hash. */
export const pinnedVersionedRefSchema = z
  .object({
    id: uuidSchema,
    version: semanticVersionSchema,
    contentHash: sha256HashSchema,
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type PinnedVersionedRef = z.infer<typeof pinnedVersionedRefSchema>;

/** A snapshot reference: stable id plus the content hash that pins its state. */
export const snapshotRefSchema = z
  .object({
    id: uuidSchema,
    contentHash: sha256HashSchema,
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type SnapshotRef = z.infer<typeof snapshotRefSchema>;
