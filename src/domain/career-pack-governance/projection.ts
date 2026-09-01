import { z } from "zod";

import { semanticVersionSchema, sha256HashSchema, stableKeySchema, uuidSchema } from "../contracts";

import type { CareerPackPublishedRecord } from "./schema";
import { careerPackPublishedRecordSchema } from "./schema";
import { CareerPackGovernanceError, validateCareerPackGovernanceRecord } from "./lifecycle";
import { governanceSemanticVersionSchema } from "./semver";

/**
 * Deterministic projection provenance / manifest.
 *
 * This is a DERIVATIVE only. It contains no authoring content and no
 * independent mutable truth, names no database table and defines no DDL. It can
 * only be built from a valid `published` governance record and is regenerated
 * solely from the exact published canonical pack.
 */

const keyListSchema = z.array(stableKeySchema);

/**
 * Runtime contract for the manifest itself. The manifest is a DERIVATIVE: it is
 * validated on the way out so it can never silently drift from the published
 * record it was derived from, and it deliberately contains no authoring content
 * and no independent mutable truth.
 */
export const careerPackProjectionManifestSchema = z
  .object({
    source: z
      .object({
        id: uuidSchema,
        version: governanceSemanticVersionSchema,
        contentHash: sha256HashSchema,
      })
      .strict(),
    governanceRecordId: uuidSchema,
    schemaVersion: semanticVersionSchema,
    occupationKey: stableKeySchema,
    occupationId: uuidSchema.nullable(),
    decisionEngineVersion: governanceSemanticVersionSchema,
    keys: z
      .object({
        questionModuleCodes: z.array(z.string().min(1)),
        questionKeys: z.array(z.string().min(1)),
        routeKeys: keyListSchema,
        requirementKeys: keyListSchema,
        requirementRuleKeys: keyListSchema,
        routeAvailabilityRuleKeys: keyListSchema,
        barrierKeys: keyListSchema,
        barrierRuleKeys: keyListSchema,
        unresolvedCheckKeys: keyListSchema,
        unresolvedCheckRuleKeys: keyListSchema,
        actionKeys: keyListSchema,
        actionRuleKeys: keyListSchema,
        evidenceKeys: keyListSchema,
        rankingConfigKeys: keyListSchema,
        localRequirementKeys: keyListSchema,
        scenarioKeys: keyListSchema,
      })
      .strict(),
  })
  .strict();

export interface CareerPackProjectionManifest {
  readonly source: {
    readonly id: string;
    readonly version: string;
    readonly contentHash: string;
  };
  readonly governanceRecordId: string;
  readonly schemaVersion: string;
  readonly occupationKey: string;
  readonly occupationId: string | null;
  readonly decisionEngineVersion: string;
  readonly keys: {
    readonly questionModuleCodes: readonly string[];
    readonly questionKeys: readonly string[];
    readonly routeKeys: readonly string[];
    readonly requirementKeys: readonly string[];
    readonly requirementRuleKeys: readonly string[];
    readonly routeAvailabilityRuleKeys: readonly string[];
    readonly barrierKeys: readonly string[];
    readonly barrierRuleKeys: readonly string[];
    readonly unresolvedCheckKeys: readonly string[];
    readonly unresolvedCheckRuleKeys: readonly string[];
    readonly actionKeys: readonly string[];
    readonly actionRuleKeys: readonly string[];
    readonly evidenceKeys: readonly string[];
    readonly rankingConfigKeys: readonly string[];
    readonly localRequirementKeys: readonly string[];
    readonly scenarioKeys: readonly string[];
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * Build the deterministic manifest for a published governance record.
 * Authored collection order is preserved exactly.
 */
export function buildCareerPackProjectionManifest(input: unknown): CareerPackProjectionManifest {
  // FULL validity, not shape validity: canonical pack, exact content hash,
  // actor separation, monotonic timestamps, valid publication evidence and
  // valid lineage all have to hold before anything can be derived.
  const validated = validateCareerPackGovernanceRecord(input);
  if (!validated.valid) throw new CareerPackGovernanceError(validated.issues);
  if (validated.record.state !== "published") {
    throw new CareerPackGovernanceError([
      {
        code: "wrong_state",
        message: `a projection manifest can only be derived from a published governance record (state: ${validated.record.state})`,
      },
    ]);
  }
  const record: CareerPackPublishedRecord = careerPackPublishedRecordSchema.parse(validated.record);

  const pack = record.pack;
  const manifest: CareerPackProjectionManifest = {
    source: {
      id: pack.careerPackId,
      version: pack.version,
      contentHash: record.contentHash,
    },
    governanceRecordId: record.governanceRecordId,
    schemaVersion: pack.schemaVersion,
    occupationKey: pack.occupation.occupationKey,
    occupationId: pack.occupation.occupationId ?? null,
    decisionEngineVersion: record.publication.decisionEngineVersion,
    keys: {
      questionModuleCodes: pack.questionModules.map((module) => module.moduleCode),
      questionKeys: pack.questionModules.flatMap((module) =>
        module.questions.map((question) => `${module.moduleCode}:${question.questionKey}`),
      ),
      routeKeys: pack.routes.map((route) => route.routeKey),
      requirementKeys: pack.requirements.map((requirement) => requirement.requirementKey),
      requirementRuleKeys: pack.requirementRules.map((rule) => rule.ruleKey),
      routeAvailabilityRuleKeys: pack.routeAvailabilityRules.map((rule) => rule.ruleKey),
      barrierKeys: pack.barriers.map((barrier) => barrier.barrierKey),
      barrierRuleKeys: pack.barrierRules.map((rule) => rule.ruleKey),
      unresolvedCheckKeys: pack.unresolvedChecks.map((check) => check.checkKey),
      unresolvedCheckRuleKeys: pack.unresolvedCheckRules.map((rule) => rule.ruleKey),
      actionKeys: pack.actions.map((action) => action.actionKey),
      actionRuleKeys: pack.actionRules.map((rule) => rule.ruleKey),
      evidenceKeys: pack.evidence.map((entry) => entry.evidenceKey),
      rankingConfigKeys: pack.rankingConfigs.map((config) => config.rankingConfigKey),
      localRequirementKeys: pack.localRequirements.map((local) => local.localRequirementKey),
      scenarioKeys: pack.scenarios.map((scenario) => scenario.scenarioKey),
    },
  };
  const checked = careerPackProjectionManifestSchema.safeParse(manifest);
  if (!checked.success) {
    throw new CareerPackGovernanceError([
      {
        code: "schema_invalid",
        message: `derived projection manifest failed its own contract: ${checked.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      },
    ]);
  }
  return deepFreeze(manifest);
}
