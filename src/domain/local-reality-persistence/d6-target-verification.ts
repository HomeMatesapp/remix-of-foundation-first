/**
 * Increment 17, Stage D6 — HOSTED APPLY + TARGET VERIFICATION record.
 *
 * Layered BESIDE the Stage D6 authoring manifest, whose semantics are unchanged:
 * authoring remains authoring, and this file is the separate, narrower record
 * that the authored prerequisite source was applied at an explicit owner gate
 * and then verified in the target project itself.
 *
 * Stage D5 remains the frozen repository evidence snapshot taken at its own
 * closure point and is NOT rewritten here.
 *
 * This record covers prerequisite capabilities ONLY. It is not authority to
 * author or apply any Local Reality relational schema.
 */

import {
  D3_PREFLIGHT_CAPABILITY_KEYS,
  type D3PreflightCapabilityInput,
  type D3PreflightCapabilityKey,
} from "./d3-readiness";
import { D6_AUTHORED_MIGRATION_PATH } from "./d6-prerequisite-authoring";

/** Version of the Stage D6 target-verification record document itself. */
export const LOCAL_REALITY_D6_TARGET_VERIFICATION_VERSION = "1.0.0" as const;

/** Date the hosted prerequisite gate was applied and verified (ISO calendar date). */
export const D6_HOSTED_APPLY_DATE = "2026-08-30" as const;

/** Hosted migration identifier recorded by the managed migration mechanism. */
export const D6_HOSTED_MIGRATION_VERSION = "20260830222016" as const;

/** Applied managed migration file corresponding to the authored D6 source. */
export const D6_APPLIED_MIGRATION_PATH =
  "supabase/migrations/20260830222016_d673d404-1627-42e9-8321-5d194a5b78c2.sql" as const;

/** Managed migrations that existed before this gate and remain historically intact. */
export const D6_PRIOR_APPLIED_MIGRATION_COUNT = 8 as const;

/** Applied inventory after the gate: the eight prior migrations plus this one. */
export const D6_APPLIED_MIGRATION_COUNT = 9 as const;

/**
 * Closed target-verification status vocabulary. `target_verified` is only
 * reachable through a successful hosted apply whose own self-verification passed.
 */
export const D6_TARGET_VERIFICATION_STATUSES = Object.freeze([
  "target_verified",
  "not_target_verified",
] as const);
export type D6TargetVerificationStatus = (typeof D6_TARGET_VERIFICATION_STATUSES)[number];

export interface D6TargetVerification {
  readonly capabilityKey: D3PreflightCapabilityKey;
  readonly status: D6TargetVerificationStatus;
  /** Concrete observations read back from the target project after apply. */
  readonly observedEvidence: readonly string[];
}

export const D6_TARGET_VERIFICATION: readonly D6TargetVerification[] = Object.freeze([
  Object.freeze({
    capabilityKey: "citext",
    status: "target_verified",
    observedEvidence: Object.freeze([
      "pg_extension reports citext version 1.6 installed in schema extensions.",
      "Schema-qualified case-insensitive equality holds: 'Registered Nurse' equals 'registered nurse' as extensions.citext.",
      "The same comparison does not over-match 'registered  nurse', so equality is case-insensitive only and claims no diacritic or whitespace normalisation.",
      "The authored migration's own scratch citext gate passed before its objects were removed.",
    ]),
  } satisfies D6TargetVerification),
  Object.freeze({
    capabilityKey: "pg_trgm",
    status: "target_verified",
    observedEvidence: Object.freeze([
      "pg_extension reports pg_trgm version 1.6 installed in schema extensions.",
      "extensions.similarity('electrician', 'electricain') returns 0.5 in the target project.",
      "The gin_trgm_ops GIN operator class is present in the extensions schema.",
      "The authored migration's own scratch trigram index build gate passed before its objects were removed.",
    ]),
  } satisfies D6TargetVerification),
  Object.freeze({
    capabilityKey: "immutable_history_enforcement",
    status: "target_verified",
    observedEvidence: Object.freeze([
      "public.forbid_mutation() exists, returns trigger, is SECURITY INVOKER and carries the narrow search_path=public configuration.",
      "authenticated has no EXECUTE privilege on public.forbid_mutation(), so it is not a client-callable business API.",
      "The authored migration's scratch gate passed: append succeeded, UPDATE and DELETE were each rejected under exact SQLSTATE 0A000 with the guard-specific table and operation message, the appended row survived unchanged, and the scratch table was removed.",
      "public.enforce_immutable_columns() remains the single pre-existing selected-column helper and was not edited.",
    ]),
  } satisfies D6TargetVerification),
] as const);

/**
 * No Local Reality relational table was created by this gate. The public schema
 * still holds only the identity and tenancy foundation tables.
 */
export const D6_NO_RELATIONAL_SCHEMA_NOTE =
  "This gate created no Local Reality relational table: no source, occupation, provider, programme, opportunity, local_snapshot, local_snapshot_item or import_batch, and no participant postcode storage of any kind." as const;

/** The only remaining sequence after this gate. Nothing is implicitly authorised. */
export const D6_TARGET_VERIFIED_NEXT_SEQUENCE = Object.freeze([
  "External inspection of the hosted apply and target-verification diff.",
  "Formal roadmap closure of the hosted prerequisite gate, recorded only after that inspection.",
  "Only then may the Local Reality relational schema stage be considered; it is neither authored nor authorised here.",
] as const);

const AUTHORISATION_NOTE =
  "Prerequisite capabilities only. Local Reality relational schema is neither authored nor applied, and this record is not authority to author or apply it." as const;

export interface D6TargetVerificationResult {
  readonly recordVersion: typeof LOCAL_REALITY_D6_TARGET_VERIFICATION_VERSION;
  readonly hostedApplyDate: typeof D6_HOSTED_APPLY_DATE;
  readonly hostedMigrationVersion: typeof D6_HOSTED_MIGRATION_VERSION;
  readonly authoredMigrationPath: typeof D6_AUTHORED_MIGRATION_PATH;
  readonly appliedMigrationPath: typeof D6_APPLIED_MIGRATION_PATH;
  readonly priorAppliedMigrationCount: typeof D6_PRIOR_APPLIED_MIGRATION_COUNT;
  readonly appliedMigrationCount: typeof D6_APPLIED_MIGRATION_COUNT;
  readonly requiredCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly targetVerifiedCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly hostedApplySucceeded: boolean;
  readonly targetProjectVerified: boolean;
  /** True only when every prerequisite capability is target verified. */
  readonly d4PreflightSatisfied: boolean;
  /** Relational schema authoring/applying is still a separate owner gate. */
  readonly relationalSchemaAuthorised: boolean;
  readonly noRelationalSchemaNote: typeof D6_NO_RELATIONAL_SCHEMA_NOTE;
  readonly nextSequence: typeof D6_TARGET_VERIFIED_NEXT_SEQUENCE;
  readonly authorisationNote: typeof AUTHORISATION_NOTE;
}

function assertExactVerificationSet(records: readonly D6TargetVerification[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (!D3_PREFLIGHT_CAPABILITY_KEYS.includes(record.capabilityKey)) {
      throw new Error(`unknown Stage D6 capability key: ${String(record.capabilityKey)}`);
    }
    if (seen.has(record.capabilityKey)) {
      throw new Error(`duplicate Stage D6 capability key: ${record.capabilityKey}`);
    }
    seen.add(record.capabilityKey);
    if (!D6_TARGET_VERIFICATION_STATUSES.includes(record.status)) {
      throw new Error(`unknown Stage D6 verification status: ${String(record.status)}`);
    }
    if (record.status === "target_verified" && record.observedEvidence.length === 0) {
      throw new Error(
        `Stage D6 target verification for ${record.capabilityKey} requires observed evidence`,
      );
    }
  }
  for (const key of D3_PREFLIGHT_CAPABILITY_KEYS) {
    if (!seen.has(key)) throw new Error(`missing Stage D6 verification record: ${key}`);
  }
}

/**
 * Deterministic Stage D6 target-verification assessment. Fails closed on
 * unknown, duplicate, missing or unevidenced records.
 */
export function assessD6TargetVerification(
  records: readonly D6TargetVerification[] = D6_TARGET_VERIFICATION,
): D6TargetVerificationResult {
  assertExactVerificationSet(records);

  const targetVerifiedCapabilityKeys = Object.freeze(
    D3_PREFLIGHT_CAPABILITY_KEYS.filter((key) =>
      records.some((record) => record.capabilityKey === key && record.status === "target_verified"),
    ),
  );
  const allVerified = targetVerifiedCapabilityKeys.length === D3_PREFLIGHT_CAPABILITY_KEYS.length;

  return Object.freeze({
    recordVersion: LOCAL_REALITY_D6_TARGET_VERIFICATION_VERSION,
    hostedApplyDate: D6_HOSTED_APPLY_DATE,
    hostedMigrationVersion: D6_HOSTED_MIGRATION_VERSION,
    authoredMigrationPath: D6_AUTHORED_MIGRATION_PATH,
    appliedMigrationPath: D6_APPLIED_MIGRATION_PATH,
    priorAppliedMigrationCount: D6_PRIOR_APPLIED_MIGRATION_COUNT,
    appliedMigrationCount: D6_APPLIED_MIGRATION_COUNT,
    requiredCapabilityKeys: D3_PREFLIGHT_CAPABILITY_KEYS,
    targetVerifiedCapabilityKeys,
    hostedApplySucceeded: true,
    targetProjectVerified: allVerified,
    d4PreflightSatisfied: allVerified,
    relationalSchemaAuthorised: false,
    noRelationalSchemaNote: D6_NO_RELATIONAL_SCHEMA_NOTE,
    nextSequence: D6_TARGET_VERIFIED_NEXT_SEQUENCE,
    authorisationNote: AUTHORISATION_NOTE,
  });
}

/**
 * Bridges TARGET-VERIFIED capabilities (never authoring) into the unchanged
 * Stage D4 capability input. Each field is true only where the target project
 * itself was verified.
 */
export function toD4PreflightCapabilityInputFromD6Verification(
  records: readonly D6TargetVerification[] = D6_TARGET_VERIFICATION,
): D3PreflightCapabilityInput {
  assertExactVerificationSet(records);
  const verified = (key: D3PreflightCapabilityKey): boolean =>
    records.some((record) => record.capabilityKey === key && record.status === "target_verified");
  return Object.freeze({
    citextVerified: verified("citext"),
    pgTrgmVerified: verified("pg_trgm"),
    immutableHistoryEnforcementVerified: verified("immutable_history_enforcement"),
  });
}
