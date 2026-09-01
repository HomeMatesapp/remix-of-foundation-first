import type { GovernanceIssue } from "./codes";
import { hashCareerPackScenarioDefinition } from "./hash";
import { governanceSemanticVersionSchema } from "./semver";
import { collectGovernanceRecordIntegrityIssues } from "./integrity";
import {
  careerPackApprovedRecordSchema,
  careerPackGovernanceRecordSchema,
  careerPackScenarioRunAttestationSchema,
  type CareerPackApprovedRecord,
  type CareerPackScenarioRunAttestation,
} from "./schema";

/**
 * Publication gate: EVIDENCE and CONTRACT validation only.
 *
 * It does NOT run the Decision Engine and does NOT evaluate scenarios. It
 * validates that a complete, exact, passing attestation set exists for the
 * exact approved pack content hash and the exact requested engine version.
 *
 * Every input is treated as RUNTIME-UNTRUSTED data. TypeScript types are never
 * the integrity boundary: the record, the requested engine version and EVERY
 * attestation are strict-parsed here, so unknown attestation fields such as
 * `model`, `prompt`, `result` or `output` make the gate FAIL rather than being
 * silently ignored.
 *
 * A missing or failed scenario BLOCKS publication. It is never a warning.
 * Ordinary validation failure returns `ok: false`; it never throws.
 */

export interface CareerPackPublicationGateInput {
  /** Untrusted candidate `approved` governance record. */
  readonly record: unknown;
  /** Untrusted requested Decision Engine version. */
  readonly decisionEngineVersion: unknown;
  /** Untrusted attestation set. */
  readonly attestations: unknown;
}

export type CareerPackPublicationGateResult =
  { readonly ok: true } | { readonly ok: false; readonly issues: readonly GovernanceIssue[] };

function parseApprovedRecord(
  input: unknown,
):
  | { readonly ok: true; readonly record: CareerPackApprovedRecord }
  | { readonly ok: false; readonly issues: readonly GovernanceIssue[] } {
  const union = careerPackGovernanceRecordSchema.safeParse(input);
  if (union.success && union.data.state !== "approved") {
    return {
      ok: false,
      issues: [
        {
          code: "wrong_state",
          message: `only an approved governance record may enter the publication gate (state: ${union.data.state})`,
        },
      ],
    };
  }
  const parsed = careerPackApprovedRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }
  return { ok: true, record: parsed.data };
}

export function validateCareerPackPublicationGate(
  input: CareerPackPublicationGateInput,
): CareerPackPublicationGateResult {
  const issues: GovernanceIssue[] = [];

  const recordResult = parseApprovedRecord(input.record);
  if (!recordResult.ok) return { ok: false, issues: recordResult.issues };
  const record = recordResult.record;

  // A merely shape-valid approved record must never be blessed: canonical pack
  // integrity, exact content hash, actor separation and monotonic timestamps
  // are established BEFORE any scenario check.
  const integrity = collectGovernanceRecordIntegrityIssues(record);
  issues.push(...integrity.issues);

  const engineVersion = governanceSemanticVersionSchema.safeParse(input.decisionEngineVersion);
  if (!engineVersion.success) {
    issues.push({
      code: "invalid_engine_version",
      message: "requested Decision Engine version is not a strict SemVer 2.0.0 version",
    });
  }

  if (!Array.isArray(input.attestations)) {
    issues.push({
      code: "schema_invalid",
      message: "attestations must be an array of scenario-run attestations",
      at: "attestations",
    });
    return { ok: false, issues };
  }

  const attestations: CareerPackScenarioRunAttestation[] = [];
  input.attestations.forEach((candidate, index) => {
    const parsed = careerPackScenarioRunAttestationSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          code: "schema_invalid",
          message: `attestation is not a valid scenario-run attestation: ${issue.message}`,
          at: `attestations[${index}]${issue.path.length > 0 ? `.${issue.path.join(".")}` : ""}`,
        });
      }
      return;
    }
    attestations.push(parsed.data);
  });
  if (issues.length > 0) return { ok: false, issues };

  const pack = integrity.canonicalPack ?? record.pack;
  const scenarios = pack.scenarios;
  if (scenarios.length === 0) {
    issues.push({
      code: "no_scenarios",
      message: "publication requires at least one canonical scenario definition",
    });
  }

  const byKey = new Map<string, CareerPackScenarioRunAttestation[]>();
  for (const attestation of attestations) {
    const bucket = byKey.get(attestation.scenarioKey);
    if (bucket) bucket.push(attestation);
    else byKey.set(attestation.scenarioKey, [attestation]);
  }

  const scenarioKeys = new Set(scenarios.map((scenario) => scenario.scenarioKey));
  for (const [key, bucket] of byKey) {
    if (!scenarioKeys.has(key)) {
      issues.push({
        code: "scenario_unknown_attestation",
        message: "attestation references a scenario that is not in the canonical pack",
        at: `scenario:${key}`,
      });
    }
    if (bucket.length > 1) {
      issues.push({
        code: "scenario_duplicate_attestation",
        message: `expected exactly one attestation, found ${bucket.length}`,
        at: `scenario:${key}`,
      });
    }
  }

  for (const scenario of scenarios) {
    const at = `scenario:${scenario.scenarioKey}`;
    const bucket = byKey.get(scenario.scenarioKey);
    if (!bucket || bucket.length === 0) {
      issues.push({
        code: "scenario_missing_attestation",
        message: "no scenario-run attestation supplied for this canonical scenario",
        at,
      });
      continue;
    }
    const expectedScenarioHash = hashCareerPackScenarioDefinition(scenario);
    for (const attestation of bucket) {
      if (attestation.scenarioDefinitionHash !== expectedScenarioHash) {
        issues.push({
          code: "scenario_definition_hash_mismatch",
          message: "attestation scenarioDefinitionHash does not match the canonical scenario",
          at,
        });
      }
      if (attestation.careerPackContentHash !== record.contentHash) {
        issues.push({
          code: "scenario_pack_hash_mismatch",
          message: "attestation careerPackContentHash does not match the approved contentHash",
          at,
        });
      }
      if (!engineVersion.success || attestation.decisionEngineVersion !== engineVersion.data) {
        issues.push({
          code: "scenario_engine_version_mismatch",
          message: "attestation was produced by a different Decision Engine version",
          at,
        });
      }
      if (attestation.passed !== true) {
        issues.push({
          code: "scenario_not_passed",
          message: "attestation did not pass; this blocks publication",
          at,
        });
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
