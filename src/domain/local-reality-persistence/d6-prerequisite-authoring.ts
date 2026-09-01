/**
 * Increment 17, Stage D6 — PREREQUISITE CAPABILITY AUTHORING manifest.
 *
 * Pure declarative record of the fact that ONE prerequisite capability
 * migration has been AUTHORED as repository source. Authoring is not
 * verification: nothing here claims that any target project has the
 * capabilities, and nothing here authorises application.
 *
 * Stage D4 and Stage D5 semantics are untouched. Stage D5 remains the frozen
 * repository evidence snapshot taken at its own closure point.
 */

import {
  D3_PREFLIGHT_CAPABILITY_KEYS,
  type D3PreflightCapabilityInput,
  type D3PreflightCapabilityKey,
} from "./d3-readiness";

/** Version of the Stage D6 authoring record document itself. */
export const LOCAL_REALITY_D6_AUTHORING_VERSION = "1.0.0" as const;

/** Date the authoring record below was written (ISO calendar date). */
export const LOCAL_REALITY_D6_AUTHORING_DATE = "2026-08-30" as const;

/**
 * The single authored prerequisite migration, held as authored source pending
 * external inspection and an explicit owner hosted-apply gate. It is the
 * intended NINTH migration in repository order, after the eight files recorded
 * in the Stage D5 evidence snapshot.
 */
export const D6_AUTHORED_MIGRATION_PATH =
  "supabase/authored-migrations/20260830220000_stage-d6-prerequisite-capabilities.sql" as const;

/** Intended ordinal position of the authored migration in repository order. */
export const D6_AUTHORED_MIGRATION_ORDINAL = 9 as const;

/**
 * Closed Stage D6 authoring-status vocabulary. There is deliberately no
 * "applied", "installed" or "verified" member: this stage can only record that
 * source exists.
 */
export const D6_AUTHORING_STATUSES = Object.freeze([
  "authored_not_applied",
  "not_authored",
] as const);
export type D6AuthoringStatus = (typeof D6_AUTHORING_STATUSES)[number];

export interface D6PrerequisiteAuthoring {
  readonly capabilityKey: D3PreflightCapabilityKey;
  /** Authoring status only. Never a live or target-state claim. */
  readonly authoringStatus: D6AuthoringStatus;
  /** Path of the authored source that covers this capability. */
  readonly authoredIn: typeof D6_AUTHORED_MIGRATION_PATH;
  /**
   * Whether the capability has been proven present in a target project.
   * Always false at Stage D6: authoring cannot verify a target.
   */
  readonly targetProjectVerified: boolean;
  /** Exact scope-limiting phrasing carried with the record. */
  readonly scopeNote: string;
  /** What the authored source is designed to establish and self-verify. */
  readonly authoredIntent: readonly string[];
  /** Fail-closed behaviour the authored source must exhibit when applied. */
  readonly failClosedBehaviour: readonly string[];
}

const AUTHORING_SCOPE_NOTE =
  "Authored as repository source only; not applied, and not verified in any target project. Target verification happens only when the migration is deliberately applied at a separate owner gate.";

export const D6_PREREQUISITE_AUTHORING: readonly D6PrerequisiteAuthoring[] = Object.freeze([
  Object.freeze({
    capabilityKey: "citext",
    authoringStatus: "authored_not_applied",
    authoredIn: D6_AUTHORED_MIGRATION_PATH,
    targetProjectVerified: false,
    scopeNote: AUTHORING_SCOPE_NOTE,
    authoredIntent: Object.freeze([
      "Check target availability first and abort with a citext-unavailable blocker if it is not offered.",
      "Establish the capability inside the existing extensions schema convention, without broadening any application role search path.",
      "Verify the schema-qualified type through a scratch relation and a deterministic case-insensitive equality check, then remove the scratch objects.",
      "Claim case-insensitive comparison only: this capability is explicitly not the diacritic-removal mechanism.",
    ]),
    failClosedBehaviour: Object.freeze([
      "Aborts when the capability is unavailable in the target project.",
      "Aborts when an already-established capability lives in an unexpected schema, instead of relying on an ambiguous search path or relocating it without review.",
      "Aborts when the case-insensitive equality verification does not behave exactly as required.",
    ]),
  } satisfies D6PrerequisiteAuthoring),
  Object.freeze({
    capabilityKey: "pg_trgm",
    authoringStatus: "authored_not_applied",
    authoredIn: D6_AUTHORED_MIGRATION_PATH,
    targetProjectVerified: false,
    scopeNote: AUTHORING_SCOPE_NOTE,
    authoredIntent: Object.freeze([
      "Check target availability first and abort with a pg_trgm-unavailable blocker if it is not offered.",
      "Establish the capability inside the existing extensions schema convention, without broadening any application role search path.",
      "Verify the schema-qualified similarity function returns a positive score for a near-miss occupation title.",
      "Verify the expected trigram operator class exists in the extensions schema and that a trigram index can actually be built on a scratch relation, then remove the scratch objects.",
    ]),
    failClosedBehaviour: Object.freeze([
      "Aborts when the capability is unavailable in the target project.",
      "Aborts when an already-established capability lives in an unexpected schema.",
      "Aborts when similarity scoring, the operator class lookup or the trigram index build verification fails.",
    ]),
  } satisfies D6PrerequisiteAuthoring),
  Object.freeze({
    capabilityKey: "immutable_history_enforcement",
    authoringStatus: "authored_not_applied",
    authoredIn: D6_AUTHORED_MIGRATION_PATH,
    targetProjectVerified: false,
    scopeNote: AUTHORING_SCOPE_NOTE,
    authoredIntent: Object.freeze([
      "Add a new generic guard function, public.forbid_mutation(), that rejects every row mutation attempt on any table wired to it.",
      "Leave the pre-existing public.enforce_immutable_columns() helper exactly as previously defined: the weaker selected-column guard is neither edited nor repurposed.",
      "Use a narrow explicit function search path, an appropriate error state and a clear message naming the table and the attempted operation.",
      "Remove client execute privileges so the guard is never a client-callable business API.",
      "Self-verify with a scratch relation wired to the guard: appending a row succeeds, both mutation paths are rejected, the appended row survives unchanged, and the scratch objects are then removed.",
    ]),
    failClosedBehaviour: Object.freeze([
      "Aborts with an immutable-history verification blocker when either mutation path is not rejected.",
      "Aborts when the appended verification row does not survive exactly as written.",
      "Drops the scratch relation before aborting, leaving no verification residue behind.",
    ]),
  } satisfies D6PrerequisiteAuthoring),
] as const);

/**
 * The spatial foundation remains a separate, prior repository fact from the
 * earliest migration. Stage D6 neither re-establishes nor modifies it, and it is
 * not one of the three prerequisite capabilities.
 */
export const D6_PRIOR_FOUNDATION_NOTE =
  "The spatial foundation was already established by the first repository migration. Stage D6 leaves it untouched and does not count it as one of the three prerequisite capabilities." as const;

/**
 * The accepted deterministic title-normalisation operations remain an open
 * schema-authoring proof obligation. Stage D6 selects NO diacritic-removal
 * mechanism and implements no normalisation function.
 */
export const D6_NORMALISE_TITLE_OBLIGATION = Object.freeze({
  mechanismSelected: false,
  implemented: false,
  note: "The accepted normalisation operations remain lowercase, punctuation removal, diacritic removal and whitespace collapsing. Stage D6 selects no mechanism for diacritic removal and implements no normalisation function; both remain later schema-authoring proof obligations.",
} as const);

/** The single next step after Stage D6. No implicit application exists. */
export const D6_NEXT_SEQUENCE = Object.freeze([
  "External diff inspection of the authored prerequisite migration source.",
  "Explicit owner hosted-apply gate, which is the only path by which the authored source may ever be applied.",
  "Only after successful application and target verification may Stage D4 schema authoring readiness be reassessed.",
] as const);

const AUTHORISATION_NOTE =
  "Stage D6 authors source and authorises nothing. Application to any target remains unauthorised until an explicit owner gate." as const;

export interface D6AuthoringResult {
  readonly authoringVersion: typeof LOCAL_REALITY_D6_AUTHORING_VERSION;
  readonly authoringDate: typeof LOCAL_REALITY_D6_AUTHORING_DATE;
  readonly authoredMigrationPaths: readonly string[];
  readonly authoredMigrationOrdinal: typeof D6_AUTHORED_MIGRATION_ORDINAL;
  readonly requiredCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly authoredCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly targetVerifiedCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly repositoryMigrationAuthored: boolean;
  readonly targetProjectVerified: boolean;
  readonly d4SchemaAuthoringReady: boolean;
  readonly hostedApplyAuthorised: boolean;
  readonly priorFoundationNote: typeof D6_PRIOR_FOUNDATION_NOTE;
  readonly normaliseTitleObligation: typeof D6_NORMALISE_TITLE_OBLIGATION;
  readonly nextSequence: typeof D6_NEXT_SEQUENCE;
  readonly authorisationNote: typeof AUTHORISATION_NOTE;
}

function assertExactAuthoringSet(records: readonly D6PrerequisiteAuthoring[]): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (!D3_PREFLIGHT_CAPABILITY_KEYS.includes(record.capabilityKey)) {
      throw new Error(`unknown Stage D6 capability key: ${String(record.capabilityKey)}`);
    }
    if (seen.has(record.capabilityKey)) {
      throw new Error(`duplicate Stage D6 capability key: ${record.capabilityKey}`);
    }
    seen.add(record.capabilityKey);
    if (!D6_AUTHORING_STATUSES.includes(record.authoringStatus)) {
      throw new Error(`unknown Stage D6 authoring status: ${String(record.authoringStatus)}`);
    }
    if (record.targetProjectVerified) {
      throw new Error(
        `Stage D6 cannot claim target verification for ${record.capabilityKey}: authoring is not verification`,
      );
    }
  }
  for (const key of D3_PREFLIGHT_CAPABILITY_KEYS) {
    if (!seen.has(key)) throw new Error(`missing Stage D6 authoring record: ${key}`);
  }
}

/**
 * Deterministic Stage D6 authoring assessment. Fails closed on unknown,
 * duplicate, missing or over-claiming records.
 */
export function assessD6PrerequisiteAuthoring(
  records: readonly D6PrerequisiteAuthoring[] = D6_PREREQUISITE_AUTHORING,
): D6AuthoringResult {
  assertExactAuthoringSet(records);

  const authoredCapabilityKeys = Object.freeze(
    D3_PREFLIGHT_CAPABILITY_KEYS.filter((key) =>
      records.some(
        (record) =>
          record.capabilityKey === key && record.authoringStatus === "authored_not_applied",
      ),
    ),
  );

  return Object.freeze({
    authoringVersion: LOCAL_REALITY_D6_AUTHORING_VERSION,
    authoringDate: LOCAL_REALITY_D6_AUTHORING_DATE,
    authoredMigrationPaths: Object.freeze([D6_AUTHORED_MIGRATION_PATH]),
    authoredMigrationOrdinal: D6_AUTHORED_MIGRATION_ORDINAL,
    requiredCapabilityKeys: D3_PREFLIGHT_CAPABILITY_KEYS,
    authoredCapabilityKeys,
    targetVerifiedCapabilityKeys: Object.freeze([]),
    repositoryMigrationAuthored:
      authoredCapabilityKeys.length === D3_PREFLIGHT_CAPABILITY_KEYS.length,
    targetProjectVerified: false,
    d4SchemaAuthoringReady: false,
    hostedApplyAuthorised: false,
    priorFoundationNote: D6_PRIOR_FOUNDATION_NOTE,
    normaliseTitleObligation: D6_NORMALISE_TITLE_OBLIGATION,
    nextSequence: D6_NEXT_SEQUENCE,
    authorisationNote: AUTHORISATION_NOTE,
  });
}

/**
 * Stage D6 contributes NO verification to the unchanged Stage D4 capability
 * input. Every field is false, by construction, until a target is verified.
 */
export function toD4PreflightCapabilityInputFromD6(
  records: readonly D6PrerequisiteAuthoring[] = D6_PREREQUISITE_AUTHORING,
): D3PreflightCapabilityInput {
  assertExactAuthoringSet(records);
  return Object.freeze({
    citextVerified: false,
    pgTrgmVerified: false,
    immutableHistoryEnforcementVerified: false,
  });
}
