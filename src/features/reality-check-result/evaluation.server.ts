import { randomUUID } from "node:crypto";

import {
  createAnswerSnapshot,
  createEvidenceContextSnapshot,
} from "../../domain/assessment-inputs";
import type { CareerPack } from "../../domain/career-packs";
import type { RealityCheckEvaluation } from "../../domain/decision-engine";
import { safeEvaluateRealityCheck } from "../../domain/decision-engine";
import { formatQuestionAddress } from "../../domain/questions";
import type { CoveragePackRef } from "../../domain/universal-coverage";
import { ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND } from "../../content/reality-check-result-copy/architecture-tests.server";
import {
  ARCHITECTURE_TEST_EVIDENCE_DISPLAY,
  REVIEWED_EVIDENCE_CHECKED_ON,
  architectureTestEvidenceRegistry,
} from "../../content/evidence-registry/architecture-tests.server";
import { resolveRealityCheckPackBinding } from "../career-discovery/coverage.server";
import {
  confirmAnswers,
  orderedPackQuestions,
  type AnswerEntry,
} from "../reality-check-experience/flow";
import { careerResultCopyByOccupationKey, resultCopyBindsExactly } from "./content-schema";
import type {
  RealityCheckEvaluationOutcome,
  ResultActionRelation,
  ResultEvidenceItem,
} from "./result-types";

/**
 * Increment 16 — the ONLY evaluation boundary.
 *
 * Server-only, because the pack-binding content-hash authority and the reviewed
 * Evidence Registry are server-side. It composes CLOSED layers and invents
 * nothing:
 *
 * - the exact Career Pack comes from the closed Increment 13/14 binding, never
 *   from the client;
 * - the answer set is re-derived here through the closed Increment 15
 *   confirmation semantics, so a tampered or stale client payload cannot smuggle
 *   an answer to a question that is not currently asked;
 * - evidence comes from the reviewed runtime Evidence Registry;
 * - the judgement, route ordering, requirement states, barriers, unresolved
 *   checks and actions come from the closed Increment 9/10 Decision Engine and
 *   are returned verbatim. This module never post-processes, re-ranks, softens or
 *   overrides them, and it never derives an outcome of its own.
 *
 * No database, no auth, no persistence, no external network call, no AI, no
 * geographic or Local Reality input.
 */

function evidenceItemsFor(
  entries: readonly {
    readonly evidenceKey: string;
    readonly revision: {
      readonly sourceId: string;
      readonly sourceRecordKey: string;
      readonly participantClassification: string;
    };
  }[],
): readonly ResultEvidenceItem[] {
  const items: ResultEvidenceItem[] = [];
  for (const entry of entries) {
    const display = ARCHITECTURE_TEST_EVIDENCE_DISPLAY.find(
      (candidate) =>
        candidate.sourceId === entry.revision.sourceId &&
        candidate.sourceRecordKey === entry.revision.sourceRecordKey,
    );
    /* No attribution, no participant-facing source claim. Never a raw key. */
    if (!display) continue;
    items.push({
      evidenceKey: entry.evidenceKey,
      label: display.label,
      url: display.url,
      checkedOn: display.checkedOn ?? REVIEWED_EVIDENCE_CHECKED_ON,
      participantClassification: entry.revision.participantClassification,
      ...(display.limitation ? { limitation: display.limitation } : {}),
    });
  }
  return items;
}

/**
 * Canonical pack relationships for the actions the ENGINE triggered.
 *
 * Only triggered keys are projected, and only relationships the pack itself
 * declares. Nothing here triggers, orders or prioritises anything.
 */
function actionRelationsFor(
  pack: CareerPack,
  triggeredActionKeys: readonly string[],
): readonly ResultActionRelation[] {
  const relations: ResultActionRelation[] = [];
  for (const actionKey of triggeredActionKeys) {
    const action = pack.actions.find((candidate) => candidate.actionKey === actionKey);
    if (!action) continue;
    relations.push({
      actionKey,
      relatedRouteKeys: [...action.relatedRouteKeys],
      relatedRequirementKeys: [...action.relatedRequirementKeys],
      relatedUnresolvedCheckKeys: [...action.relatedUnresolvedCheckKeys],
      relatedBarrierKeys: [...action.relatedBarrierKeys],
    });
  }
  return relations;
}

/**
 * Evidence keys attached, by the exact bound pack, to the elements this result
 * actually surfaces: candidate-route and overall requirement assessments,
 * surfaced barriers and triggered actions.
 *
 * This is canonical pack attribution only — no new attribution is invented, and
 * the closed engine is untouched. There is NO fallback to the whole evidence
 * context: when nothing narrower can be established the set stays empty.

 */
function relevantEvidenceKeys(
  pack: CareerPack,
  evaluation: RealityCheckEvaluation,
): ReadonlySet<string> {
  const requirementKeys = new Set<string>();
  const barrierKeys = new Set<string>();
  for (const assessment of evaluation.result.requirementAssessments) {
    requirementKeys.add(assessment.requirement.requirementKey);
  }
  for (const barrier of evaluation.result.barriers) barrierKeys.add(barrier.barrierKey);
  for (const candidate of evaluation.result.candidateRoutes) {
    for (const assessment of [
      ...candidate.eligibility.requirementAssessments,
      ...candidate.practicalFit.requirementAssessments,
    ]) {
      requirementKeys.add(assessment.requirement.requirementKey);
    }
    for (const barrier of candidate.barriers) barrierKeys.add(barrier.barrierKey);
  }

  const keys = new Set<string>();
  for (const requirement of pack.requirements) {
    if (requirementKeys.has(requirement.requirementKey)) {
      for (const key of requirement.evidenceKeys) keys.add(key);
    }
  }
  for (const barrier of pack.barriers) {
    if (barrierKeys.has(barrier.barrierKey)) {
      for (const key of barrier.evidenceKeys) keys.add(key);
    }
  }
  for (const action of pack.actions) {
    if (evaluation.triggeredActionKeys.includes(action.actionKey)) {
      for (const key of action.evidenceKeys) keys.add(key);
    }
  }
  return keys;
}

/**
 * Narrows the reviewed evidence context to the evidence canonically related to
 * the elements this result actually surfaces.
 *
 * There is deliberately NO fallback to the whole Evidence Context: unrelated
 * pack evidence must never be attributed to this result. An empty relevant set
 * yields an empty list, and the result simply shows no result-specific sources.
 * The full immutable Evidence Context is still snapshotted and evaluated; only
 * participant attribution is narrowed here.
 */
function relevantEvidenceEntries<T extends { readonly evidenceKey: string }>(
  entries: readonly T[],
  relevant: ReadonlySet<string>,
): readonly T[] {
  return entries.filter((entry) => relevant.has(entry.evidenceKey));
}

/** Every submitted answer must address a question this exact pack declares. */
function submittedRefsAreDeclared(pack: CareerPack, answers: readonly SubmittedAnswer[]): boolean {
  const declared = new Set(
    orderedPackQuestions(pack).map((question) => formatQuestionAddress(question)),
  );
  const seen = new Set<string>();
  for (const entry of answers) {
    const address = `${entry.question.moduleCode}:${entry.question.questionKey}`;
    if (!declared.has(address)) return false;
    /* A duplicated question ref is a defective payload, never a last-wins merge. */
    if (seen.has(address)) return false;
    seen.add(address);
  }
  return true;
}

/** A submitted answer before its question ref has been proven declared. */
export interface SubmittedAnswer {
  readonly question: { readonly moduleCode: string; readonly questionKey: string };
  readonly value: AnswerEntry["value"];
}

export function evaluateConfirmedRealityCheck(input: {
  readonly occupationKey: string;
  /** The pack ref the client believes it answered. Checked, never trusted. */
  readonly declaredPack: CoveragePackRef;
  /**
   * Loosely typed submitted answers. Question module codes arrive as plain
   * strings and are only narrowed after being matched against the bound pack's
   * own declared questions, so an undeclared code can never reach the engine.
   */
  readonly answers: readonly SubmittedAnswer[];
  /** Caller-supplied ISO instant; the engine itself never reads a clock. */
  readonly evaluatedAt: string;
  readonly binding: ReturnType<typeof resolveRealityCheckPackBinding>;
}): RealityCheckEvaluationOutcome {
  const { binding } = input;
  if (binding.state !== "assessment_available") return { state: "assessment_not_available_yet" };
  if (
    binding.occupationKey !== input.occupationKey ||
    binding.pack.careerPackId !== input.declaredPack.careerPackId ||
    binding.pack.version !== input.declaredPack.version ||
    binding.pack.contentHash !== input.declaredPack.contentHash
  ) {
    /* The client answered a different questionnaire than the one bound here. */
    return { state: "assessment_not_available_yet" };
  }

  const pack = binding.document;
  if (!submittedRefsAreDeclared(pack, input.answers)) return { state: "answers_rejected" };

  /*
   * Reviewed result copy must bind EXACTLY to this pack: same occupation, same
   * pack id, same version, the same exact canonical content hash and full
   * two-way key coverage. A pack whose bytes have moved on at all therefore
   * yields no participant result until its copy is reconciled,
   * rather than rendering stale wording beside fresh engine truth.
   */
  const copy = careerResultCopyByOccupationKey(
    ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND,
    binding.occupationKey,
  );
  if (!resultCopyBindsExactly(pack, copy, binding.pack.contentHash)) {
    return { state: "evaluation_unavailable" };
  }

  /* Increment 15 semantics, re-derived server-side. Nothing is trusted. */
  const confirmation = confirmAnswers({
    pack,
    packRef: binding.pack,
    occupationKey: binding.occupationKey,
    /* Safe: every ref above was matched against the pack's declared questions. */
    entries: input.answers as readonly AnswerEntry[],
  });
  if (!confirmation.ok) return { state: "answers_incomplete", missing: confirmation.missing };

  const answerSnapshot = createAnswerSnapshot({
    snapshotId: randomUUID(),
    pack,
    answers: confirmation.confirmed.answers.map((entry) => ({
      question: entry.question,
      value: entry.value,
    })),
  });
  if (!answerSnapshot.ok) return { state: "evaluation_unavailable" };

  let evidenceContext;
  try {
    evidenceContext = createEvidenceContextSnapshot({
      snapshotId: randomUUID(),
      pack,
      registry: architectureTestEvidenceRegistry(),
    });
  } catch {
    /* Reviewed evidence content that does not parse yields NO result. */
    return { state: "evaluation_unavailable" };
  }
  if (!evidenceContext.ok) return { state: "evaluation_unavailable" };

  const evaluation = safeEvaluateRealityCheck({
    pack,
    answerSnapshot: answerSnapshot.snapshot,
    evidenceContext: evidenceContext.snapshot,
    evaluatedAt: input.evaluatedAt,
  });
  if (!evaluation.ok) return { state: "evaluation_unavailable" };

  const relevant = relevantEvidenceKeys(pack, evaluation.evaluation);

  return {
    state: "evaluated",
    occupationKey: binding.occupationKey,
    pack: binding.pack,
    evaluatedAt: input.evaluatedAt,
    evaluation: evaluation.evaluation,
    evidence: evidenceItemsFor(relevantEvidenceEntries(evidenceContext.snapshot.entries, relevant)),
    actionRelations: actionRelationsFor(pack, evaluation.evaluation.triggeredActionKeys),
  };
}
