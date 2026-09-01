/**
 * Increment 17, Stage D5 — PREFLIGHT CAPABILITY EVIDENCE contract.
 *
 * Pure immutable evidence layer recording exactly what the current repository
 * migration history PROVES and what it does not prove about the three Stage D3
 * and Stage D4 preflight capabilities. It records inspection outcomes only.
 *
 * This stage does not author, execute or authorise anything. Absence of an
 * artefact in repository history is NOT a claim about any hosted target state,
 * and no capability here may be read as installed, live or available.
 */

import {
  D3_PREFLIGHT_CAPABILITY_KEYS,
  type D3PreflightCapabilityInput,
  type D3PreflightCapabilityKey,
} from "./d3-readiness";

/** Version of the Stage D5 evidence record document itself. */
export const LOCAL_REALITY_D5_EVIDENCE_VERSION = "1.0.0" as const;

/** Date the repository evidence below was inspected (ISO calendar date). */
export const LOCAL_REALITY_D5_EVIDENCE_DATE = "2026-08-30" as const;

/**
 * The ONLY evidence source Stage D5 may draw on: files already committed to
 * this repository's migration history. No hosted or live inspection occurred.
 */
export const LOCAL_REALITY_D5_EVIDENCE_SOURCE_SCOPE = "repository_migration_history" as const;

/**
 * Complete inspected migration inventory, in committed order. Declarative
 * string data describing which files were read; nothing is loaded or executed.
 */
export const D5_INSPECTED_MIGRATION_PATHS = Object.freeze([
  "supabase/migrations/20260824234007_4b897f34-6a28-4311-b2ce-e30374969b29.sql",
  "supabase/migrations/20260824234158_937e2390-91b1-4b09-85cf-8f8d4072bed4.sql",
  "supabase/migrations/20260824234215_23fb84a5-391f-4fdb-847f-c02345ba8545.sql",
  "supabase/migrations/20260824234518_38975b10-d72c-4de5-b601-4305654ef17f.sql",
  "supabase/migrations/20260825094629_76bee35c-142d-44a1-9a75-4f24ffe5639d.sql",
  "supabase/migrations/20260825100416_c63c67fc-065e-45d9-8102-a8f255a943ce.sql",
  "supabase/migrations/20260825100436_56375ed1-f836-4ae4-9a20-acdede1f524a.sql",
  "supabase/migrations/20260825175811_5ece808c-abfe-4434-8f57-e183af642eab.sql",
] as const);

/**
 * Closed CAPABILITY-STATUS vocabulary. Deliberately repository-scoped: there is
 * no "installed", "live" or "available" member, because no hosted state was or
 * could be inspected at this stage. It carries no partial member either:
 * partial evidence never changes an overall capability status.
 */
export const D5_EVIDENCE_STATUSES = Object.freeze([
  "verified_by_repository",
  "not_established_in_repository",
] as const);
export type D5EvidenceStatus = (typeof D5_EVIDENCE_STATUSES)[number];

/**
 * Closed EVIDENCE-STRENGTH vocabulary, separate from capability status.
 * `partial_insufficient` records that some related helper infrastructure exists
 * in repository history while the capability itself remains unestablished.
 */
export const D5_EVIDENCE_STRENGTHS = Object.freeze(["none", "partial_insufficient"] as const);
export type D5EvidenceStrength = (typeof D5_EVIDENCE_STRENGTHS)[number];

export interface D5PreflightEvidence {
  readonly capabilityKey: D3PreflightCapabilityKey;
  /** OVERALL capability status from repository history alone. */
  readonly status: D5EvidenceStatus;
  /**
   * Strength of any related repository evidence found. Recorded separately so
   * partial helper infrastructure can never be read as capability status.
   */
  readonly evidenceStrength: D5EvidenceStrength;
  /**
   * Overall capability verification. False for every capability that is not
   * fully established by repository history, including partial evidence.
   */
  readonly verified: boolean;
  /** Exact scope-limiting phrasing carried with the evidence. */
  readonly scopeNote: string;
  /** What repository inspection actually found. */
  readonly observations: readonly string[];
  /** Why the evidence does not amount to verification. */
  readonly insufficiencyReasons: readonly string[];
}

const REPOSITORY_SCOPE_NOTE =
  "Not established by current repository migration history / requires prerequisite authoring and later target-project verification.";

/**
 * Evidence for the three required preflight capabilities, in the same canonical
 * order as `D3_PREFLIGHT_CAPABILITY_KEYS`.
 */
export const D5_PREFLIGHT_EVIDENCE: readonly D5PreflightEvidence[] = Object.freeze([
  Object.freeze({
    capabilityKey: "citext",
    status: "not_established_in_repository",
    evidenceStrength: "none",
    verified: false,
    scopeNote: REPOSITORY_SCOPE_NOTE,
    observations: Object.freeze([
      "All eight committed migration files were inspected end to end.",
      "No migration contains any statement that establishes or verifies the citext capability.",
    ]),
    insufficiencyReasons: Object.freeze([
      "The capability has no authored prerequisite at all, so nothing exists to inspect or rely on.",
      "Repository absence says nothing about any target project; it must not be read as absent or present there.",
    ]),
  } satisfies D5PreflightEvidence),
  Object.freeze({
    capabilityKey: "pg_trgm",
    status: "not_established_in_repository",
    evidenceStrength: "none",
    verified: false,
    scopeNote: REPOSITORY_SCOPE_NOTE,
    observations: Object.freeze([
      "All eight committed migration files were inspected end to end.",
      "No migration contains any statement that establishes or verifies the pg_trgm capability.",
    ]),
    insufficiencyReasons: Object.freeze([
      "The capability has no authored prerequisite at all, so nothing exists to inspect or rely on.",
      "Repository absence says nothing about any target project; it must not be read as absent or present there.",
    ]),
  } satisfies D5PreflightEvidence),
  Object.freeze({
    capabilityKey: "immutable_history_enforcement",
    status: "not_established_in_repository",
    evidenceStrength: "partial_insufficient",
    verified: false,
    scopeNote: REPOSITORY_SCOPE_NOTE,
    observations: Object.freeze([
      "Increment 1 Part 2 defines the generic helper public.enforce_immutable_columns.",
      "That helper receives a list of column names through TG_ARGV and raises only when one of those selected columns differs on an UPDATE, otherwise returning NEW.",
      "No later committed migration defines a full forbid_mutation helper or any equivalent whole-history guard.",
    ]),
    insufficiencyReasons: Object.freeze([
      "public.enforce_immutable_columns is a selected-column UPDATE guard only: it permits an UPDATE that touches any column outside its argument list.",
      "It contains no whole-row UPDATE ban, so a historical row remains mutable in unguarded columns.",
      "It contains no DELETE rejection path at all, so historical rows remain removable.",
      "It is therefore PARTIAL and INSUFFICIENT helper infrastructure for immutable historical tables, and is never reclassified as full enforcement.",
    ]),
  } satisfies D5PreflightEvidence),
] as const);

export interface D5EstablishedFoundationEvidence {
  readonly factKey: string;
  readonly status: Extract<D5EvidenceStatus, "verified_by_repository">;
  readonly sourceMigrationPath: string;
  readonly observations: readonly string[];
  readonly scopeNote: string;
}

/**
 * Already-established static foundation facts. These are recorded SEPARATELY
 * and are never members of the three unresolved preflight capabilities.
 */
export const D5_ESTABLISHED_FOUNDATION_EVIDENCE: readonly D5EstablishedFoundationEvidence[] =
  Object.freeze([
    Object.freeze({
      factKey: "spatial_foundation",
      status: "verified_by_repository",
      sourceMigrationPath: D5_INSPECTED_MIGRATION_PATHS[0],
      observations: Object.freeze([
        "The first committed migration establishes and verifies the spatial extension inside the extensions schema.",
        "It exercises a geography scratch relation, the GIST operator class and the distance and within-distance functions before completing.",
      ]),
      scopeNote:
        "Established static foundation fact of repository history only; recorded without any new claim about live or hosted state.",
    } satisfies D5EstablishedFoundationEvidence),
  ] as const);

/**
 * Ordered technical sequencing conclusion. This is NOT an owner-decision
 * blocker: it is what must be authored next, in this order.
 */
export const D5_NEXT_SEQUENCE = Object.freeze([
  "Author prerequisites establishing the citext and pg_trgm capabilities with explicit target verification and fail-closed behaviour.",
  "Author a full immutable-history helper that rejects every UPDATE and every DELETE for the historical tables wired to it; Stage D5 does not implement it.",
  "Prove the accepted deterministic normalise_title contract, including the accepted diacritic-removal operation, during prerequisite and schema authoring; Stage D5 selects no mechanism or extension that is not already approved.",
  "Only after prerequisite authoring is externally inspected may it later be applied at a separate hosted owner gate; Local Reality schema authoring or application must not assume these prerequisites already exist.",
] as const);

export interface D5RepositoryPreflightResult {
  readonly evidenceVersion: typeof LOCAL_REALITY_D5_EVIDENCE_VERSION;
  readonly evidenceDate: typeof LOCAL_REALITY_D5_EVIDENCE_DATE;
  readonly sourceScope: typeof LOCAL_REALITY_D5_EVIDENCE_SOURCE_SCOPE;
  readonly inspectedMigrationPaths: readonly string[];
  readonly requiredCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly verifiedCapabilityKeys: readonly D3PreflightCapabilityKey[];
  readonly unverifiedCapabilityKeys: readonly D3PreflightCapabilityKey[];
  /** Inspection of repository history is COMPLETE. This is not a pass. */
  readonly repositoryPreflightComplete: boolean;
  readonly prerequisiteAuthoringRequired: boolean;
  readonly localSchemaAuthoringReady: boolean;
  readonly hostedApplyAuthorised: boolean;
  readonly nextSequence: readonly string[];
  readonly authorisationNote: string;
}

const AUTHORISATION_NOTE =
  "Repository-evidence statement only. Inspection completeness is not capability verification, and nothing here authorises authoring or applying any hosted relational change.";

function assertExactEvidenceSet(evidence: readonly D5PreflightEvidence[]): void {
  const seen = new Set<string>();
  for (const entry of evidence) {
    if (!D3_PREFLIGHT_CAPABILITY_KEYS.includes(entry.capabilityKey)) {
      throw new Error(`Unknown Stage D5 preflight capability key: ${String(entry.capabilityKey)}`);
    }
    if (seen.has(entry.capabilityKey)) {
      throw new Error(`Duplicate Stage D5 preflight evidence for: ${entry.capabilityKey}`);
    }
    if (!D5_EVIDENCE_STATUSES.includes(entry.status)) {
      throw new Error(`Unknown Stage D5 evidence status: ${String(entry.status)}`);
    }
    if (!D5_EVIDENCE_STRENGTHS.includes(entry.evidenceStrength)) {
      throw new Error(`Unknown Stage D5 evidence strength: ${String(entry.evidenceStrength)}`);
    }
    if (entry.verified && entry.status !== "verified_by_repository") {
      throw new Error(
        `Stage D5 evidence for ${entry.capabilityKey} claims verification without repository proof.`,
      );
    }

    seen.add(entry.capabilityKey);
  }
  for (const key of D3_PREFLIGHT_CAPABILITY_KEYS) {
    if (!seen.has(key)) {
      throw new Error(`Missing Stage D5 preflight evidence for: ${key}`);
    }
  }
}

/**
 * Deterministic assessment of repository preflight evidence. Fails closed on
 * unknown, duplicate, missing or over-claiming evidence.
 */
export function assessD5RepositoryPreflights(
  evidence: readonly D5PreflightEvidence[] = D5_PREFLIGHT_EVIDENCE,
): D5RepositoryPreflightResult {
  assertExactEvidenceSet(evidence);

  const verifiedCapabilityKeys = Object.freeze(
    D3_PREFLIGHT_CAPABILITY_KEYS.filter((key) =>
      evidence.some((entry) => entry.capabilityKey === key && entry.verified),
    ),
  );
  const unverifiedCapabilityKeys = Object.freeze(
    D3_PREFLIGHT_CAPABILITY_KEYS.filter((key) => !verifiedCapabilityKeys.includes(key)),
  );

  return Object.freeze({
    evidenceVersion: LOCAL_REALITY_D5_EVIDENCE_VERSION,
    evidenceDate: LOCAL_REALITY_D5_EVIDENCE_DATE,
    sourceScope: LOCAL_REALITY_D5_EVIDENCE_SOURCE_SCOPE,
    inspectedMigrationPaths: D5_INSPECTED_MIGRATION_PATHS,
    requiredCapabilityKeys: D3_PREFLIGHT_CAPABILITY_KEYS,
    verifiedCapabilityKeys,
    unverifiedCapabilityKeys,
    repositoryPreflightComplete: true,
    prerequisiteAuthoringRequired: unverifiedCapabilityKeys.length > 0,
    localSchemaAuthoringReady: unverifiedCapabilityKeys.length === 0,
    hostedApplyAuthorised: false,
    nextSequence: D5_NEXT_SEQUENCE,
    authorisationNote: AUTHORISATION_NOTE,
  });
}

/**
 * Bridges ONLY truly repository-verified evidence into the unchanged Stage D4
 * capability input. Under current evidence every field is false.
 */
export function toD4PreflightCapabilityInput(
  evidence: readonly D5PreflightEvidence[] = D5_PREFLIGHT_EVIDENCE,
): D3PreflightCapabilityInput {
  assertExactEvidenceSet(evidence);
  const isVerified = (key: D3PreflightCapabilityKey): boolean =>
    evidence.some((entry) => entry.capabilityKey === key && entry.verified);
  return Object.freeze({
    citextVerified: isVerified("citext"),
    pgTrgmVerified: isVerified("pg_trgm"),
    immutableHistoryEnforcementVerified: isVerified("immutable_history_enforcement"),
  });
}
