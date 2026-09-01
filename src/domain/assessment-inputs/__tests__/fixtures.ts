import { parseCanonicalCareerPack, type CareerPack } from "../../career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../career-packs/version";
import { parseCanonicalEvidenceRegistry, type EvidenceRegistry } from "../../evidence-registry";
import { EVIDENCE_REGISTRY_SCHEMA_VERSION } from "../../evidence-registry/codes";

/**
 * SYNTHETIC internal fixtures only. No participant-facing copy, no real
 * occupation, no real evidence source and no real career pack content.
 */

export const PACK_ID = "11111111-1111-4111-8111-111111111111";
export const SNAPSHOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_SNAPSHOT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const SOURCE_ID = "44444444-4444-4444-8444-444444444444";
export const SOURCE_B_ID = "55555555-5555-4555-8555-555555555555";

export const RECORD_KEY_A = "src/rec-a?ref=1";
/** Hostile but schema-valid external key: embedded NUL and a tab. */
export const HOSTILE_RECORD_KEY = "src\u0000rec\tb";

export function hex(label: string): string {
  return label.padEnd(64, "0");
}

/**
 * Career Pack embedding one question of every structural input kind plus two
 * evidence keys.
 */
export function packInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: CAREER_PACK_SCHEMA_VERSION,
    careerPackId: PACK_ID,
    version: "1.4.2",
    occupation: { occupationKey: "occ_synthetic" },
    questionModules: [
      {
        moduleCode: "qualifications",
        frameworkVersion: "1.0.0",
        questions: [
          {
            questionKey: "q_holds_level_3",
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
            questionKey: "q_count",
            moduleCode: "qualifications",
            input: { kind: "integer", min: 0, max: 10 },
            consequences: ["eligibility"],
          },
        ],
      },
      {
        moduleCode: "driving",
        frameworkVersion: "1.0.0",
        questions: [
          {
            questionKey: "q_licences",
            moduleCode: "driving",
            input: { kind: "multi_select", optionKeys: ["opt_car", "opt_van", "opt_bus"] },
            consequences: ["practical_fit"],
          },
        ],
      },
      {
        moduleCode: "finance",
        frameworkVersion: "1.0.0",
        questions: [
          {
            questionKey: "q_hourly_rate",
            moduleCode: "finance",
            input: { kind: "decimal", min: 0, max: 100 },
            consequences: ["practical_fit"],
          },
        ],
      },
      {
        moduleCode: "study_availability",
        frameworkVersion: "1.0.0",
        questions: [
          {
            questionKey: "q_note",
            moduleCode: "study_availability",
            input: { kind: "text", minLength: 3, maxLength: 20 },
            consequences: ["practical_fit"],
          },
          {
            questionKey: "q_start",
            moduleCode: "study_availability",
            input: { kind: "date" },
            consequences: ["practical_fit"],
          },
        ],
      },
    ],
    routes: [
      {
        routeKey: "route_a",
        eligibilityRequirementKeys: [],
        practicalFitRequirementKeys: [],
        availabilityRuleKeys: [],
        localRequirementKeys: [],
      },
    ],
    evidence: [
      { evidenceKey: "ev_b", reference: { sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A } },
      {
        evidenceKey: "ev_a",
        reference: { sourceId: SOURCE_B_ID, sourceRecordKey: HOSTILE_RECORD_KEY },
      },
    ],
    ...overrides,
  };
}

export function pack(overrides: Record<string, unknown> = {}): CareerPack {
  return parseCanonicalCareerPack(packInput(overrides));
}

export interface RevisionOverrides {
  readonly sourceId?: string;
  readonly sourceRecordKey?: string;
  readonly recordVersion?: string;
  readonly recordContentHash?: string;
  readonly grade?: string;
  readonly participantClassification?: string;
  readonly retrievedAt?: string;
  readonly reviewDueAt?: string | null;
  readonly supersedes?: unknown;
  readonly withdrawal?: unknown;
}

export function revision(overrides: RevisionOverrides = {}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    sourceId: SOURCE_ID,
    sourceRecordKey: RECORD_KEY_A,
    recordVersion: "1.0.0",
    recordContentHash: hex("a1"),
    grade: "B",
    participantClassification: "provider_dependent",
    retrievedAt: "2026-01-01T00:00:00Z",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    base[key] = value;
  }
  return base;
}

export function registryInput(records: readonly unknown[]): Record<string, unknown> {
  return {
    registryVersion: EVIDENCE_REGISTRY_SCHEMA_VERSION,
    sources: [
      { sourceId: SOURCE_ID, sourceKey: "source.a" },
      { sourceId: SOURCE_B_ID, sourceKey: "source.b" },
    ],
    records: [...records],
  };
}

/** Registry covering both fixture pack evidence references. */
export function registry(
  extra: {
    readonly recordAOverrides?: RevisionOverrides;
    readonly recordBOverrides?: RevisionOverrides;
    readonly records?: readonly unknown[];
  } = {},
): EvidenceRegistry {
  const records = extra.records ?? [
    revision(extra.recordAOverrides ?? {}),
    revision({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      recordContentHash: hex("c3"),
      grade: "A",
      participantClassification: "confirmed_requirement",
      ...(extra.recordBOverrides ?? {}),
    }),
  ];
  return parseCanonicalEvidenceRegistry(registryInput(records));
}
