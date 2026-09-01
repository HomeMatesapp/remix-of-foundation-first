import { z } from "zod";

/**
 * Governed catalogues for Career Pack publication governance.
 *
 * Every exported catalogue is frozen at module initialisation so caller
 * mutation via casting cannot alter later reads.
 */

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * EXACTLY five governed lifecycle states. No aliases, no `in_review`, no
 * `rejected`, no `archived`, no reinstatement state.
 */
export const CAREER_PACK_LIFECYCLE_STATES = Object.freeze([
  "draft",
  "reviewed",
  "approved",
  "published",
  "withdrawn",
] as const);
export type CareerPackLifecycleState = (typeof CAREER_PACK_LIFECYCLE_STATES)[number];
export const careerPackLifecycleStateSchema = z.enum(CAREER_PACK_LIFECYCLE_STATES);

/**
 * Forward-only lifecycle order as a frozen tuple index lookup. A `Map` is
 * deliberately NOT used: a JavaScript `Map` stays mutable at runtime through
 * `.set()` even when TypeScript calls it readonly.
 */
export function careerPackLifecycleOrder(state: CareerPackLifecycleState): number {
  return CAREER_PACK_LIFECYCLE_STATES.indexOf(state);
}

/* -------------------------------------------------------------------------- */
/* Internal governance roles (Increment 1 set, exactly)                       */
/* -------------------------------------------------------------------------- */

export const INTERNAL_GOVERNANCE_ROLES = Object.freeze([
  "viewer",
  "editor",
  "reviewer",
  "approver",
  "admin",
] as const);
export type InternalGovernanceRole = (typeof INTERNAL_GOVERNANCE_ROLES)[number];
export const internalGovernanceRoleSchema = z.enum(INTERNAL_GOVERNANCE_ROLES);

/** Roles that may be recorded as the authority actually exercised at a stage. */
export const GOVERNANCE_AUTHORITY_ROLES = Object.freeze([
  "editor",
  "reviewer",
  "approver",
  "admin",
] as const);
export type GovernanceAuthorityRole = (typeof GOVERNANCE_AUTHORITY_ROLES)[number];
export const governanceAuthorityRoleSchema = z.enum(GOVERNANCE_AUTHORITY_ROLES);

/* -------------------------------------------------------------------------- */
/* Capabilities                                                               */
/* -------------------------------------------------------------------------- */

export const GOVERNANCE_CAPABILITIES = Object.freeze([
  "create_draft",
  "review",
  "approve",
  "publish",
  "withdraw",
] as const);
export type GovernanceCapability = (typeof GOVERNANCE_CAPABILITIES)[number];

/**
 * Capability -> permitted roles. `admin` carries capability everywhere, but
 * NEVER bypasses author != reviewer != approver separation.
 */
export const GOVERNANCE_CAPABILITY_ROLES: Readonly<
  Record<GovernanceCapability, readonly InternalGovernanceRole[]>
> = Object.freeze({
  create_draft: Object.freeze(["editor", "admin"] as const),
  review: Object.freeze(["reviewer", "admin"] as const),
  approve: Object.freeze(["approver", "admin"] as const),
  publish: Object.freeze(["approver", "admin"] as const),
  withdraw: Object.freeze(["approver", "admin"] as const),
});

/* -------------------------------------------------------------------------- */
/* Issue codes                                                                */
/* -------------------------------------------------------------------------- */

export const GOVERNANCE_ISSUE_CODES = Object.freeze([
  "schema_invalid",
  "unauthorised_role",
  "actor_separation_violation",
  "timestamp_reversal",
  "content_hash_mismatch",
  "wrong_state",
  "scenario_missing_attestation",
  "scenario_duplicate_attestation",
  "scenario_unknown_attestation",
  "scenario_definition_hash_mismatch",
  "scenario_pack_hash_mismatch",
  "scenario_engine_version_mismatch",
  "scenario_not_passed",
  "no_scenarios",
  "version_not_greater",
  "lineage_pack_mismatch",
  "invalid_engine_version",
  "invalid_lineage_ref",
  "invalid_actor_context",
] as const);
export type GovernanceIssueCode = (typeof GOVERNANCE_ISSUE_CODES)[number];

export interface GovernanceIssue {
  readonly code: GovernanceIssueCode;
  readonly message: string;
  readonly at?: string;
}

/** Version of this governance framework. Not a pack or engine version. */
export const CAREER_PACK_GOVERNANCE_VERSION = "1.0.0" as const;
