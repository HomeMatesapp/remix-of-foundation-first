import {
  createAnswerSnapshot,
  createEvidenceContextSnapshot,
  EVIDENCE_CONTEXT_SCHEMA_VERSION,
  parseCanonicalEvidenceContextSnapshot,
  pinnedCareerPackRef,
  type AnswerSnapshot,
  type EvidenceContextSnapshot,
} from "../../assessment-inputs";

import { parseCanonicalCareerPack, type CareerPack } from "../../career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../career-packs/version";
import { parseCanonicalEvidenceRegistry, type EvidenceRegistry } from "../../evidence-registry";
import { EVIDENCE_REGISTRY_SCHEMA_VERSION } from "../../evidence-registry/codes";
import type { QuestionAnswerValue, QuestionRef } from "../../questions";

/**
 * SYNTHETIC engine fixtures. No real occupation, route, provider, evidence
 * source or participant copy: the engine is career-agnostic and so are its tests.
 */

export const PACK_ID = "11111111-1111-4111-8111-111111111111";
export const ANSWER_SNAPSHOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const EVIDENCE_SNAPSHOT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const SOURCE_ID = "44444444-4444-4444-8444-444444444444";
export const RECORD_KEY = "src/rec-a";
export const EVALUATED_AT = "2026-02-01T00:00:00Z";

export function hex(label: string): string {
  return label.padEnd(64, "0");
}

export function q(questionKey: string): QuestionRef {
  return { moduleCode: "qualifications", questionKey };
}

export const QUESTION_MODULES = [
  {
    moduleCode: "qualifications",
    frameworkVersion: "1.0.0",
    questions: [
      {
        questionKey: "q_flag",
        moduleCode: "qualifications",
        input: { kind: "boolean" },
        consequences: ["eligibility"],
      },
      {
        questionKey: "q_other",
        moduleCode: "qualifications",
        input: { kind: "boolean" },
        consequences: ["eligibility"],
      },
      {
        questionKey: "q_level",
        moduleCode: "qualifications",
        input: { kind: "single_select", optionKeys: ["opt_a", "opt_b"] },
        consequences: ["eligibility"],
      },
      {
        questionKey: "q_list",
        moduleCode: "qualifications",
        input: { kind: "multi_select", optionKeys: ["opt_car", "opt_van"] },
        consequences: ["practical_fit"],
      },
      {
        questionKey: "q_count",
        moduleCode: "qualifications",
        input: { kind: "integer", min: 0, max: 10 },
        consequences: ["eligibility"],
      },
    ],
  },
];

export const PACK_EVIDENCE = [
  { evidenceKey: "ev_a", reference: { sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY } },
];

export function packInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: CAREER_PACK_SCHEMA_VERSION,
    careerPackId: PACK_ID,
    version: "1.0.0",
    occupation: { occupationKey: "occ_synthetic" },
    questionModules: QUESTION_MODULES,
    routes: [
      {
        routeKey: "route_a",
        eligibilityRequirementKeys: [],
        practicalFitRequirementKeys: [],
        availabilityRuleKeys: [],
        localRequirementKeys: [],
      },
    ],
    evidence: PACK_EVIDENCE,
    ...overrides,
  };
}

export function pack(overrides: Record<string, unknown> = {}): CareerPack {
  return parseCanonicalCareerPack(packInput(overrides));
}

export interface RevisionOverrides {
  readonly grade?: string;
  readonly participantClassification?: string;
  readonly withdrawal?: unknown;
}

export function registry(overrides: RevisionOverrides = {}): EvidenceRegistry {
  const record: Record<string, unknown> = {
    sourceId: SOURCE_ID,
    sourceRecordKey: RECORD_KEY,
    recordVersion: "1.0.0",
    recordContentHash: hex("a1"),
    grade: overrides.grade ?? "A",
    participantClassification: overrides.participantClassification ?? "confirmed_requirement",
    retrievedAt: "2026-01-01T00:00:00Z",
  };
  if (overrides.withdrawal !== undefined) record["withdrawal"] = overrides.withdrawal;
  return parseCanonicalEvidenceRegistry({
    registryVersion: EVIDENCE_REGISTRY_SCHEMA_VERSION,
    sources: [{ sourceId: SOURCE_ID, sourceKey: "source.a" }],
    records: [record],
  });
}

export function evidenceContext(
  target: CareerPack,
  overrides: RevisionOverrides = {},
): EvidenceContextSnapshot {
  const outcome = createEvidenceContextSnapshot({
    snapshotId: EVIDENCE_SNAPSHOT_ID,
    pack: target,
    registry: registry(overrides),
  });
  if (!outcome.ok)
    throw new Error(`fixture evidence context invalid: ${JSON.stringify(outcome.issues)}`);
  return outcome.snapshot;
}

export function answers(
  target: CareerPack,
  entries: readonly { readonly question: QuestionRef; readonly value: QuestionAnswerValue }[],
): AnswerSnapshot {
  const outcome = createAnswerSnapshot({
    snapshotId: ANSWER_SNAPSHOT_ID,
    pack: target,
    answers: entries,
  });
  if (!outcome.ok)
    throw new Error(`fixture answer snapshot invalid: ${JSON.stringify(outcome.issues)}`);
  return outcome.snapshot;
}

/**
 * A HISTORICAL Evidence Context Snapshot whose embedded revision is withdrawn.
 *
 * The Increment 8 builder deliberately refuses a withdrawn revision as NEW
 * current input, so this uses the canonical validating boundary directly — the
 * same path a reconstructed historical snapshot takes. No validator is bypassed
 * or weakened: the document is fully strict-parsed against the exact pack.
 */
export function withdrawnEvidenceContext(
  target: CareerPack,
  overrides: { readonly grade?: string; readonly participantClassification?: string } = {},
): EvidenceContextSnapshot {
  return parseCanonicalEvidenceContextSnapshot(
    {
      schemaVersion: EVIDENCE_CONTEXT_SCHEMA_VERSION,
      snapshotId: EVIDENCE_SNAPSHOT_ID,
      careerPack: pinnedCareerPackRef(target),
      entries: [
        {
          evidenceKey: "ev_a",
          revision: {
            sourceId: SOURCE_ID,
            sourceRecordKey: RECORD_KEY,
            recordVersion: "1.0.0",
            recordContentHash: hex("a1"),
            grade: overrides.grade ?? "A",
            participantClassification:
              overrides.participantClassification ?? "confirmed_requirement",
            retrievedAt: "2026-01-01T00:00:00Z",
            withdrawal: {
              withdrawnAt: "2026-01-15T00:00:00Z",
              reasonKey: "reason_superseded_guidance",
            },
          },
        },
      ],
    },
    target,
  );
}
