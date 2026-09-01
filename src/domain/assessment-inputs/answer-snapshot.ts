import { z } from "zod";

import type { CareerPack } from "../career-packs";
import { pinnedVersionedRefSchema, uuidSchema, type SnapshotRef } from "../contracts";
import {
  isCalendarDate,
  questionAnswerValueSchema,
  questionRefSchema,
  type QuestionAnswerValue,
  type QuestionInput,
  type QuestionRef,
} from "../questions";
import {
  compareCanonicalKeys,
  contentHashOfCanonicalDocument,
  deepFreezeDocument,
  pinnedCareerPackRef,
  pinnedRefsEqual,
  questionIdentityKey,
  snapshotRefOfDocument,
} from "./canonical";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerSnapshotIssue,
  type AnswerSnapshotValidationResult,
} from "./codes";

/**
 * Canonical Answer Snapshot document.
 *
 * Deterministic assessment INPUT state only. There is deliberately no
 * participant, user, account or institution identity, no display copy, prompt or
 * label, no generative metadata, no eligibility/requirement/route/judgement
 * outcome, no ranking, no draft/progress state and no self-referential content
 * hash field.
 *
 * Validation here is STRUCTURAL confirmed-answer validation. It never executes
 * question visibility dependencies or Career Pack consequential rules: deciding
 * whether a question should have been asked is not this document's job.
 */

export const answerSnapshotEntrySchema = z
  .object({
    question: questionRefSchema,
    value: questionAnswerValueSchema,
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type AnswerSnapshotEntry = z.infer<typeof answerSnapshotEntrySchema>;

export const answerSnapshotSchema = z
  .object({
    schemaVersion: z.literal(ANSWER_SNAPSHOT_SCHEMA_VERSION),
    snapshotId: uuidSchema,
    /** Exact pinned Career Pack: id + content version + content hash. */
    careerPack: pinnedVersionedRefSchema,
    /** Confirmed answers only. An absent question is unanswered, never false. */
    answers: z.array(answerSnapshotEntrySchema),
  })
  .strict();
export type AnswerSnapshot = z.infer<typeof answerSnapshotSchema>;

/* -------------------------------------------------------------------------- */
/* Career Pack question index                                                 */
/* -------------------------------------------------------------------------- */

function indexPackQuestions(pack: CareerPack): ReadonlyMap<string, QuestionInput> {
  const index = new Map<string, QuestionInput>();
  for (const module of pack.questionModules) {
    for (const question of module.questions) {
      index.set(
        questionIdentityKey({
          moduleCode: question.moduleCode,
          questionKey: question.questionKey,
        }),
        question.input,
      );
    }
  }
  return index;
}

/** Stable internal question address for issue reporting. */
function addressOf(ref: QuestionRef): string {
  return questionIdentityKey(ref);
}

/* -------------------------------------------------------------------------- */
/* Structural answer-value validation                                         */
/* -------------------------------------------------------------------------- */

function withinBounds(
  value: number,
  bounds: { readonly min?: number | undefined; readonly max?: number | undefined },
): boolean {
  if (bounds.min !== undefined && value < bounds.min) return false;
  if (bounds.max !== undefined && value > bounds.max) return false;
  return true;
}

/**
 * Validate one confirmed answer against its exact declared input kind and
 * return the CANONICAL value (multi-select selections deterministically ordered;
 * text preserved byte for byte).
 */
function validateAnswerValue(
  input: QuestionInput,
  value: QuestionAnswerValue,
  at: string,
):
  | { readonly ok: true; readonly value: QuestionAnswerValue }
  | { readonly ok: false; readonly issue: AnswerSnapshotIssue } {
  const kindMismatch = (): { readonly ok: false; readonly issue: AnswerSnapshotIssue } => ({
    ok: false,
    issue: {
      code: "answer_kind_mismatch",
      message: `answer type does not match declared input kind ${input.kind}`,
      at,
    },
  });

  switch (input.kind) {
    case "boolean":
      if (typeof value !== "boolean") return kindMismatch();
      return { ok: true, value };

    case "single_select": {
      if (typeof value !== "string") return kindMismatch();
      if (!input.optionKeys.includes(value)) {
        return {
          ok: false,
          issue: {
            code: "unknown_option_key",
            message: "single-select value is not a declared option key",
            at,
          },
        };
      }
      return { ok: true, value };
    }

    case "multi_select": {
      if (!Array.isArray(value)) return kindMismatch();
      if (value.some((entry) => typeof entry !== "string")) return kindMismatch();
      if (value.length === 0) {
        return {
          ok: false,
          issue: {
            code: "empty_selection",
            message: "an empty multi-select selection is unanswered, not a confirmed answer",
            at,
          },
        };
      }
      if (new Set(value).size !== value.length) {
        return {
          ok: false,
          issue: {
            code: "duplicate_option_key",
            message: "multi-select selection contains a duplicate option key",
            at,
          },
        };
      }
      const unknown = value.find((entry) => !input.optionKeys.includes(entry));
      if (unknown !== undefined) {
        return {
          ok: false,
          issue: {
            code: "unknown_option_key",
            message: "multi-select selection contains an undeclared option key",
            at,
          },
        };
      }
      // Selection order carries no meaning: canonicalise so equivalent sets hash
      // identically. Option keys are Clear Routes-owned stable keys.
      return { ok: true, value: [...value].sort(compareCanonicalKeys) };
    }

    case "integer": {
      if (typeof value !== "number") return kindMismatch();
      if (!Number.isInteger(value)) {
        return {
          ok: false,
          issue: { code: "answer_kind_mismatch", message: "value must be an integer", at },
        };
      }
      if (!withinBounds(value, input)) {
        return {
          ok: false,
          issue: {
            code: "value_out_of_range",
            message: "value is outside the declared structural bounds",
            at,
          },
        };
      }
      return { ok: true, value };
    }

    case "decimal": {
      if (typeof value !== "number" || !Number.isFinite(value)) return kindMismatch();
      if (!withinBounds(value, input)) {
        return {
          ok: false,
          issue: {
            code: "value_out_of_range",
            message: "value is outside the declared structural bounds",
            at,
          },
        };
      }
      return { ok: true, value };
    }

    case "text": {
      if (typeof value !== "string") return kindMismatch();
      if (value.trim().length === 0) {
        return { ok: false, issue: { code: "text_invalid", message: "text is blank", at } };
      }
      if (input.minLength !== undefined && value.length < input.minLength) {
        return {
          ok: false,
          issue: { code: "text_invalid", message: "text is shorter than minLength", at },
        };
      }
      if (input.maxLength !== undefined && value.length > input.maxLength) {
        return {
          ok: false,
          issue: { code: "text_invalid", message: "text is longer than maxLength", at },
        };
      }
      // Participant text is stored verbatim: never trimmed or rewritten.
      return { ok: true, value };
    }

    case "date": {
      if (typeof value !== "string") return kindMismatch();
      if (!isCalendarDate(value)) {
        return {
          ok: false,
          issue: {
            code: "date_invalid",
            message: "date must be a real YYYY-MM-DD calendar date",
            at,
          },
        };
      }
      return { ok: true, value };
    }

    default:
      return kindMismatch();
  }
}

/* -------------------------------------------------------------------------- */
/* Whole-document validation and canonicalisation                             */
/* -------------------------------------------------------------------------- */

interface CanonicalisationOutcome {
  readonly valid: boolean;
  readonly issues: readonly AnswerSnapshotIssue[];
  readonly snapshot?: AnswerSnapshot;
}

function canonicaliseAnswerSnapshot(input: unknown, pack: CareerPack): CanonicalisationOutcome {
  const parsed = answerSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }
  const document = parsed.data;
  const issues: AnswerSnapshotIssue[] = [];

  const expected = pinnedCareerPackRef(pack);
  if (!pinnedRefsEqual(document.careerPack, expected)) {
    issues.push({
      code: "career_pack_binding_mismatch",
      message:
        "snapshot Career Pack id, version or content hash does not match the exact canonical Career Pack",
      at: "careerPack",
    });
  }

  const questions = indexPackQuestions(pack);
  const seen = new Set<string>();
  const canonicalEntries: AnswerSnapshotEntry[] = [];

  document.answers.forEach((entry) => {
    const key = questionIdentityKey(entry.question);
    const at = addressOf(entry.question);
    if (seen.has(key)) {
      issues.push({ code: "duplicate_question", message: "duplicate question reference", at });
      return;
    }
    seen.add(key);

    const declared = questions.get(key);
    if (!declared) {
      issues.push({
        code: "unknown_question",
        message: "answer references a question absent from the Career Pack",
        at,
      });
      return;
    }
    const value = validateAnswerValue(declared, entry.value, at);
    if (!value.ok) {
      issues.push(value.issue);
      return;
    }
    canonicalEntries.push({ question: entry.question, value: value.value });
  });

  if (issues.length > 0) return { valid: false, issues };

  // Answer-set semantics are independent of caller array order.
  canonicalEntries.sort((left, right) =>
    compareCanonicalKeys(questionIdentityKey(left.question), questionIdentityKey(right.question)),
  );

  return {
    valid: true,
    issues: [],
    snapshot: deepFreezeDocument({
      schemaVersion: document.schemaVersion,
      snapshotId: document.snapshotId,
      careerPack: { ...expected },
      answers: canonicalEntries,
    }),
  };
}

export class AnswerSnapshotValidationError extends Error {
  readonly issues: readonly AnswerSnapshotIssue[];

  constructor(issues: readonly AnswerSnapshotIssue[]) {
    super(
      `invalid canonical Answer Snapshot: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "AnswerSnapshotValidationError";
    this.issues = issues;
  }
}

/** Structural validation against the exact canonical Career Pack. */
export function validateAnswerSnapshot(
  input: unknown,
  pack: CareerPack,
): AnswerSnapshotValidationResult {
  const outcome = canonicaliseAnswerSnapshot(input, pack);
  return { valid: outcome.valid, issues: outcome.issues };
}

/** Strict-parse, validate, canonicalise order and deep-freeze. Fails closed. */
export function parseCanonicalAnswerSnapshot(input: unknown, pack: CareerPack): AnswerSnapshot {
  const outcome = canonicaliseAnswerSnapshot(input, pack);
  if (!outcome.snapshot) throw new AnswerSnapshotValidationError(outcome.issues);
  return outcome.snapshot;
}

/** Non-throwing variant. */
export function safeParseCanonicalAnswerSnapshot(
  input: unknown,
  pack: CareerPack,
):
  | { readonly ok: true; readonly snapshot: AnswerSnapshot }
  | { readonly ok: false; readonly issues: readonly AnswerSnapshotIssue[] } {
  const outcome = canonicaliseAnswerSnapshot(input, pack);
  if (!outcome.snapshot) return { ok: false, issues: outcome.issues };
  return { ok: true, snapshot: outcome.snapshot };
}

/**
 * Build a canonical Answer Snapshot from confirmed answers plus the exact
 * canonical Career Pack. The pinned Career Pack reference is always recomputed;
 * a caller can never supply it.
 */
export function createAnswerSnapshot(args: {
  readonly snapshotId: string;
  readonly pack: CareerPack;
  readonly answers: readonly {
    readonly question: QuestionRef;
    readonly value: QuestionAnswerValue;
  }[];
}):
  | { readonly ok: true; readonly snapshot: AnswerSnapshot }
  | { readonly ok: false; readonly issues: readonly AnswerSnapshotIssue[] } {
  return safeParseCanonicalAnswerSnapshot(
    {
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: args.snapshotId,
      careerPack: pinnedCareerPackRef(args.pack),
      answers: args.answers.map((entry) => ({ question: entry.question, value: entry.value })),
    },
    args.pack,
  );
}

/** Deterministic content hash of the canonical finalised document. */
export function hashCanonicalAnswerSnapshot(snapshot: AnswerSnapshot): string {
  return contentHashOfCanonicalDocument(snapshot);
}

/** Existing `SnapshotRef` shape `{ id: snapshotId, contentHash }`. */
export function answerSnapshotRef(snapshot: AnswerSnapshot): SnapshotRef {
  return snapshotRefOfDocument(snapshot);
}
