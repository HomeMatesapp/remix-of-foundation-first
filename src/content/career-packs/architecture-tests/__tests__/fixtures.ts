import { createHash } from "node:crypto";

import {
  createAnswerSnapshot,
  createEvidenceContextSnapshot,
  type AnswerSnapshot,
  type EvidenceContextSnapshot,
} from "../../../../domain/assessment-inputs";
import type { CareerPack } from "../../../../domain/career-packs";
import {
  parseCanonicalEvidenceRegistry,
  type EvidenceRegistry,
} from "../../../../domain/evidence-registry";
import { EVIDENCE_REGISTRY_SCHEMA_VERSION } from "../../../../domain/evidence-registry/codes";
import type { QuestionAnswerValue, QuestionRef } from "../../../../domain/questions";
import { ARCHITECTURE_TEST_PACKS, ARCHITECTURE_TEST_SOURCES } from "..";

/**
 * TEST-ONLY Evidence Registry fixture.
 *
 * It carries no source document body, no URL, no live retrieval and no live
 * ingestion. Record versions and content hashes are deterministic fixture values
 * derived from the stable source identity, so a historical evaluation is exactly
 * reproducible without pretending to pin a real external revision.
 */

export const ARCHITECTURE_TEST_EVALUATED_AT = "2026-08-26T00:00:00Z";
export const ARCHITECTURE_TEST_RETRIEVED_AT = "2026-08-26T00:00:00Z";
export const FIXTURE_RECORD_VERSION = "1.0.0";

function fixtureContentHash(sourceId: string, sourceRecordKey: string): string {
  return createHash("sha256")
    .update(`architecture-test-fixture:${sourceId}:${sourceRecordKey}:${FIXTURE_RECORD_VERSION}`)
    .digest("hex");
}

interface FixtureRecord {
  readonly sourceId: string;
  readonly sourceRecordKey: string;
  readonly recordVersion: string;
  readonly recordContentHash: string;
  readonly grade: string;
  readonly participantClassification: string;
  readonly retrievedAt: string;
}

/**
 * Derive exactly one immutable revision per referenced source record, taking
 * grade and participant classification from the packs themselves. A record
 * referenced with two different strengths is a content contradiction and fails
 * loudly here rather than being silently reconciled.
 */
function fixtureRecords(): readonly FixtureRecord[] {
  const byIdentity = new Map<string, FixtureRecord>();
  for (const pack of ARCHITECTURE_TEST_PACKS) {
    for (const entry of pack.evidence) {
      const { sourceId, sourceRecordKey, grade, participantClassification } = entry.reference;
      if (typeof grade !== "string" || typeof participantClassification !== "string") {
        throw new Error(
          `architecture-test evidence ${entry.evidenceKey} must declare grade and classification`,
        );
      }
      const identity = `${sourceId}::${sourceRecordKey}`;
      const record: FixtureRecord = {
        sourceId,
        sourceRecordKey,
        recordVersion: FIXTURE_RECORD_VERSION,
        recordContentHash: fixtureContentHash(sourceId, sourceRecordKey),
        grade,
        participantClassification,
        retrievedAt: ARCHITECTURE_TEST_RETRIEVED_AT,
      };
      const existing = byIdentity.get(identity);
      if (existing) {
        if (
          existing.grade !== record.grade ||
          existing.participantClassification !== record.participantClassification
        ) {
          throw new Error(`conflicting declared evidence strength for record ${identity}`);
        }
        continue;
      }
      byIdentity.set(identity, record);
    }
  }
  return [...byIdentity.values()].sort((a, b) =>
    `${a.sourceId}::${a.sourceRecordKey}`.localeCompare(`${b.sourceId}::${b.sourceRecordKey}`),
  );
}

export function architectureTestRegistry(): EvidenceRegistry {
  return parseCanonicalEvidenceRegistry({
    registryVersion: EVIDENCE_REGISTRY_SCHEMA_VERSION,
    sources: ARCHITECTURE_TEST_SOURCES.map((source) => ({ ...source })),
    records: fixtureRecords().map((record) => ({ ...record })),
  });
}

/** Deterministic snapshot identities, one per architecture-test pack. */
const SNAPSHOT_IDS: Readonly<Record<string, { evidence: string; answers: string }>> = {
  registered_nurse: {
    evidence: "e0000001-0000-4000-8000-000000000001",
    answers: "a0000001-0000-4000-8000-000000000001",
  },
  electrician: {
    evidence: "e0000002-0000-4000-8000-000000000002",
    answers: "a0000002-0000-4000-8000-000000000002",
  },
  solicitor_england_wales: {
    evidence: "e0000003-0000-4000-8000-000000000003",
    answers: "a0000003-0000-4000-8000-000000000003",
  },
  photographer: {
    evidence: "e0000004-0000-4000-8000-000000000004",
    answers: "a0000004-0000-4000-8000-000000000004",
  },
};

function snapshotIds(pack: CareerPack): { evidence: string; answers: string } {
  const ids = SNAPSHOT_IDS[pack.occupation.occupationKey];
  if (!ids) throw new Error(`no fixture snapshot ids for ${pack.occupation.occupationKey}`);
  return ids;
}

export function answerSnapshotId(pack: CareerPack): string {
  return snapshotIds(pack).answers;
}

export function evidenceContextFor(pack: CareerPack): EvidenceContextSnapshot {
  const outcome = createEvidenceContextSnapshot({
    snapshotId: snapshotIds(pack).evidence,
    pack,
    registry: architectureTestRegistry(),
  });
  if (!outcome.ok) {
    throw new Error(`fixture evidence context invalid: ${JSON.stringify(outcome.issues)}`);
  }
  return outcome.snapshot;
}

export function answersFor(
  pack: CareerPack,
  entries: readonly { readonly question: QuestionRef; readonly value: QuestionAnswerValue }[],
): AnswerSnapshot {
  const outcome = createAnswerSnapshot({
    snapshotId: snapshotIds(pack).answers,
    pack,
    answers: entries,
  });
  if (!outcome.ok) {
    throw new Error(`fixture answer snapshot invalid: ${JSON.stringify(outcome.issues)}`);
  }
  return outcome.snapshot;
}

/** Answers taken verbatim from a declared pack scenario. */
export function scenarioAnswers(pack: CareerPack, scenarioKey: string): AnswerSnapshot {
  const scenario = pack.scenarios.find((entry) => entry.scenarioKey === scenarioKey);
  if (!scenario) throw new Error(`unknown scenario ${scenarioKey}`);
  return answersFor(
    pack,
    scenario.answers.map((fixture) => ({ question: fixture.question, value: fixture.value })),
  );
}
