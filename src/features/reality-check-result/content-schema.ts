import { z } from "zod";

import type { CareerPack } from "../../domain/career-packs";

/**
 * Increment 16 — participant-facing Reality Check RESULT presentation content.
 *
 * The frozen Career Pack and the Decision Engine carry consequential truth and
 * deliberately carry NO participant copy: a requirement, route, barrier,
 * unresolved check, action and ranking factor are stable machine keys only. This
 * separate layer supplies the wording for those exact keys.
 *
 * Hard boundaries encoded here:
 * - presentation copy is NEVER assessment truth: no state, no judgement, no
 *   score, no confidence, no threshold, no availability and no ordering field;
 * - copy can never introduce a route, requirement, barrier, check, action or
 *   factor the bound Career Pack does not declare;
 * - a participant-visible key with no copy is a FAIL-CLOSED defect, never a raw
 *   key rendered on screen.
 */

const NON_BLANK = z.string().trim().min(1);
const SENTENCE = NON_BLANK.max(400);
const LABEL = NON_BLANK.max(140);
const STABLE_KEY = z.string().regex(/^[a-z][a-z0-9_]*$/, "stable keys are lower snake_case");

/** Participant wording for exactly one declared route. */
export const resultRouteCopySchema = z
  .object({
    routeKey: STABLE_KEY,
    label: LABEL,
    /**
     * Honest commitment warning for this route, shown before any money or time
     * is committed. Never a promise, never a recommendation.
     */
    beforeYouSpend: SENTENCE,
  })
  .strict();
export type ResultRouteCopy = z.infer<typeof resultRouteCopySchema>;

/** Participant wording for exactly one declared requirement. */
export const resultRequirementCopySchema = z
  .object({
    requirementKey: STABLE_KEY,
    label: LABEL,
    /** Wording used when the engine reports this requirement as met. */
    met: SENTENCE,
    /**
     * Wording used when the engine reports this requirement as not met, unknown
     * or needing verification. It describes the outstanding matter only; the
     * STATE itself always comes from the engine, never from this string.
     */
    gap: SENTENCE,
  })
  .strict();
export type ResultRequirementCopy = z.infer<typeof resultRequirementCopySchema>;

export const resultBarrierCopySchema = z
  .object({ barrierKey: STABLE_KEY, label: LABEL, explanation: SENTENCE })
  .strict();
export type ResultBarrierCopy = z.infer<typeof resultBarrierCopySchema>;

/** Participant wording for exactly one declared unresolved check. */
export const resultCheckCopySchema = z
  .object({
    checkKey: STABLE_KEY,
    /** What is not yet known. */
    issue: LABEL,
    whyItMatters: SENTENCE,
    /** What could resolve it. Never a promise that it will resolve favourably. */
    whatCouldResolveIt: SENTENCE,
  })
  .strict();
export type ResultCheckCopy = z.infer<typeof resultCheckCopySchema>;

export const resultActionCopySchema = z
  .object({ actionKey: STABLE_KEY, label: LABEL, guidance: SENTENCE })
  .strict();
export type ResultActionCopy = z.infer<typeof resultActionCopySchema>;

/** Participant wording for one declared ranking factor that positively matched. */
export const resultFactorCopySchema = z
  .object({ factorKey: STABLE_KEY, statement: SENTENCE })
  .strict();
export type ResultFactorCopy = z.infer<typeof resultFactorCopySchema>;

/*
 * There is deliberately NO authored next-step priority layer. Which actions are
 * triggered is engine truth, and the canonical key order the engine emits carries
 * no priority. Presentation must therefore never nominate a preferred next step
 * out of SEVERAL triggered actions; only a single triggered action for a route
 * can be shown prominently, because there is nothing to choose between.
 */

export const careerResultCopySchema = z
  .object({
    occupationKey: STABLE_KEY,
    careerPackId: z.string().uuid(),
    /**
     * The exact Career Pack version this copy was reviewed against. A pack that
     * moves on must have its result copy reconciled before any participant
     * result is rendered.
     */
    careerPackVersion: z.string().regex(/^\d+\.\d+\.\d+$/, "expected an exact semantic version"),
    /**
     * The exact canonical Career Pack CONTENT HASH this copy was reviewed
     * against. Identity, version and stable-key shape can all stay the same
     * while pack bytes change; only this pins the exact reviewed document.
     *
     * This is presentation binding to the exact bound pack. It is not, and does
     * not claim to be, publication immutability governance.
     */
    careerPackContentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "expected the canonical SHA-256 content hash"),

    careerTitle: LABEL,
    routes: z.array(resultRouteCopySchema).min(1),
    requirements: z.array(resultRequirementCopySchema),
    barriers: z.array(resultBarrierCopySchema),
    checks: z.array(resultCheckCopySchema),
    actions: z.array(resultActionCopySchema),
    factors: z.array(resultFactorCopySchema),
  })
  .strict();
export type CareerResultCopy = z.infer<typeof careerResultCopySchema>;

/* -------------------------------------------------------------------------- */
/* Coverage                                                                   */
/* -------------------------------------------------------------------------- */

export interface ResultCopyCoverageDefect {
  /** Machine-only diagnostic. Never participant-facing. */
  readonly kind:
    "missing" | "undeclared" | "duplicate" | "version_mismatch" | "content_hash_mismatch";
  readonly entity: "route" | "requirement" | "barrier" | "check" | "action" | "factor" | "pack";

  readonly key: string;
}

/**
 * Canonical Career Pack content hasher, injected by the caller.
 *
 * This module stays browser-safe: canonical hashing is deliberately server-side,
 * so the EXISTING canonical implementation (`hashCanonicalCareerPack`) is passed
 * in by server-only callers rather than imported here. No second hashing
 * algorithm exists.
 */
export type CareerPackContentHasher = (pack: CareerPack) => string;

/**
 * Two-way coverage for one collection.
 *
 * Set membership alone does NOT prove the authored copy is unambiguous: two
 * authored entries for the same key both satisfy coverage while leaving which
 * wording a participant sees dependent on array order. Duplicates are therefore
 * a fail-closed defect for EVERY authored collection.
 */
function compare(
  entity: ResultCopyCoverageDefect["entity"],
  declared: readonly string[],
  authored: readonly string[],
): readonly ResultCopyCoverageDefect[] {
  const declaredSet = new Set(declared);
  const authoredSet = new Set(authored);
  const defects: ResultCopyCoverageDefect[] = [];
  for (const key of declared) {
    if (!authoredSet.has(key)) defects.push({ kind: "missing", entity, key });
  }
  for (const key of authored) {
    if (!declaredSet.has(key)) defects.push({ kind: "undeclared", entity, key });
  }
  const seen = new Set<string>();
  for (const key of authored) {
    if (seen.has(key)) {
      if (!defects.some((defect) => defect.kind === "duplicate" && defect.key === key)) {
        defects.push({ kind: "duplicate", entity, key });
      }
      continue;
    }
    seen.add(key);
  }
  return defects;
}

/**
 * Exact two-way coverage between one Career Pack and its authored result copy.
 *
 * Missing copy would show a participant an internal key; undeclared copy would
 * describe something the pack does not contain. Both are defects.
 *
 * When a canonical hasher is supplied, the authored `careerPackContentHash` is
 * additionally checked against the EXACT canonical hash of this pack document, so
 * pack byte drift is a `content_hash_mismatch` defect even when the id, version
 * and every stable key remain identical.
 */
export function resultCopyCoverageDefects(
  pack: CareerPack,
  copy: CareerResultCopy,
  hashPack?: CareerPackContentHasher,
): readonly ResultCopyCoverageDefect[] {
  const declaredRouteKeys = pack.routes.map((route) => route.routeKey);
  const declaredActionKeys = pack.actions.map((action) => action.actionKey);

  /*
   * Exact canonical content-hash binding, when a canonical hasher is supplied.
   * Recomputed from the pack document: an authored hash can never assert itself
   * true.
   */
  const contentHashDefects: ResultCopyCoverageDefect[] = [];
  if (hashPack) {
    const canonicalHash = hashPack(pack);
    if (copy.careerPackContentHash !== canonicalHash) {
      contentHashDefects.push({
        kind: "content_hash_mismatch",
        entity: "pack",
        key: `${copy.careerPackContentHash} != ${canonicalHash}`,
      });
    }
  }

  return [
    ...contentHashDefects,
    /* The copy must have been reviewed against THIS pack version. */
    ...(copy.careerPackVersion === pack.version
      ? []
      : [
          {
            kind: "version_mismatch" as const,
            entity: "pack" as const,
            key: `${copy.careerPackVersion} != ${pack.version}`,
          },
        ]),
    ...(copy.careerPackId === pack.careerPackId
      ? []
      : [{ kind: "undeclared" as const, entity: "pack" as const, key: copy.careerPackId }]),
    ...compare(
      "route",
      declaredRouteKeys,
      copy.routes.map((entry) => entry.routeKey),
    ),
    ...compare(
      "requirement",
      pack.requirements.map((requirement) => requirement.requirementKey),
      copy.requirements.map((entry) => entry.requirementKey),
    ),
    ...compare(
      "barrier",
      pack.barriers.map((barrier) => barrier.barrierKey),
      copy.barriers.map((entry) => entry.barrierKey),
    ),
    ...compare(
      "check",
      pack.unresolvedChecks.map((check) => check.checkKey),
      copy.checks.map((entry) => entry.checkKey),
    ),
    ...compare(
      "action",
      declaredActionKeys,
      copy.actions.map((entry) => entry.actionKey),
    ),
    ...compare(
      "factor",
      pack.rankingConfigs.flatMap((config) => config.factors.map((factor) => factor.factorKey)),
      copy.factors.map((entry) => entry.factorKey),
    ),
  ];
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Parses authored result copy, checks EXACT coverage against the bound Career
 * Packs and deep-freezes the outcome. Any defect throws: no partial result copy
 * is ever published.
 *
 * When `hashPack` is supplied (the existing canonical `hashCanonicalCareerPack`,
 * injected by server-only callers) the authored `careerPackContentHash` is
 * verified at LOAD time, so authored copy fails closed when pack bytes drift even
 * though the id, version and every stable key are unchanged.
 */
export function parseCareerResultCopySet(
  input: readonly unknown[],
  packs: readonly CareerPack[],
  hashPack?: CareerPackContentHasher,
): readonly CareerResultCopy[] {
  const parsed = input.map((entry) => careerResultCopySchema.parse(entry));

  const occupationKeys = parsed.map((entry) => entry.occupationKey);
  if (new Set(occupationKeys).size !== occupationKeys.length) {
    throw new Error("duplicate occupationKey in result copy set");
  }

  for (const copy of parsed) {
    const pack = packs.find(
      (candidate) =>
        candidate.occupation.occupationKey === copy.occupationKey &&
        candidate.careerPackId === copy.careerPackId,
    );
    if (!pack) {
      throw new Error(`result copy ${copy.occupationKey} is not bound to a known Career Pack`);
    }
    const defects = resultCopyCoverageDefects(pack, copy, hashPack);
    if (defects.length > 0) {
      throw new Error(
        `result copy ${copy.occupationKey} fails coverage: ${defects
          .map((defect) => `${defect.kind} ${defect.entity} ${defect.key}`)
          .join(", ")}`,
      );
    }
  }

  return deepFreeze(parsed) as readonly CareerResultCopy[];
}

/** Exact occupation lookup. Never a fuzzy or partial match. */
export function careerResultCopyByOccupationKey(
  set: readonly CareerResultCopy[],
  occupationKey: string,
): CareerResultCopy | undefined {
  return set.find((entry) => entry.occupationKey === occupationKey);
}

/**
 * Exact runtime binding check between reviewed result copy and the Career Pack
 * document actually bound for this evaluation.
 *
 * Identity, version, the EXACT canonical content hash of the bound pack and
 * full two-way key coverage must all agree. Pack bytes can change while the id,
 * version and every stable key stay identical, so the content hash is the only
 * thing that pins the exact reviewed document. A pack that has changed
 * therefore requires reviewed result-copy reconciliation before any participant
 * result is rendered; stale copy fails closed instead.
 *
 * `careerPackContentHash` is the caller's exact canonical hash of the bound pack
 * document, taken from the existing canonical Career Pack hashing/ref
 * infrastructure. No second hashing algorithm exists here.
 *
 * This is presentation binding to the exact bound pack, not publication
 * immutability governance.
 */
export function resultCopyBindsExactly(
  pack: CareerPack,
  copy: CareerResultCopy | undefined,
  careerPackContentHash: string,
): copy is CareerResultCopy {
  if (!copy) return false;
  if (copy.occupationKey !== pack.occupation.occupationKey) return false;
  if (copy.careerPackContentHash !== careerPackContentHash) return false;
  return resultCopyCoverageDefects(pack, copy).length === 0;
}

/**
 * Browser-safe exact presentation binding check.
 *
 * The browser never re-hashes a pack: it compares the authored copy against the
 * exact pack ref the server established for this evaluation.
 */
export function resultCopyMatchesPackRef(
  copy: CareerResultCopy | undefined,
  packRef: {
    readonly careerPackId: string;
    readonly version: string;
    readonly contentHash: string;
  },
): copy is CareerResultCopy {
  if (!copy) return false;
  return (
    copy.careerPackId === packRef.careerPackId &&
    copy.careerPackVersion === packRef.version &&
    copy.careerPackContentHash === packRef.contentHash
  );
}
