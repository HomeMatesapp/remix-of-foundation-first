import { z } from "zod";

/**
 * Increment 14 — participant-facing career overview PRESENTATION content model.
 *
 * This layer is deliberately separate from the frozen canonical Career Pack.
 * The Career Pack carries consequential truth (routes, requirements, rules,
 * evidence strength) and explicitly carries NO participant copy, salary or
 * demand. This model carries only descriptive participant copy, keyed by exact
 * canonical occupation identity.
 *
 * Hard boundaries encoded here:
 * - no eligibility, practical-fit, barrier, unresolved-check or judgement field;
 * - no demand rating, suitability score, route score or confidence value;
 * - no local availability, provider or vacancy field;
 * - no second evidence grading system — overview sources are descriptive only.
 */

const NON_BLANK = z.string().trim().min(1);
const SENTENCE = NON_BLANK.max(400);
const BULLETS = z.array(SENTENCE).min(3).max(4);
const STABLE_KEY = z.string().regex(/^[a-z][a-z0-9_]*$/, "stable keys are lower snake_case");
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "checkedAt must be YYYY-MM-DD");

/** Exact canonical occupation identity. Never a display value. */
export const overviewOccupationRefSchema = z
  .object({
    occupationId: z.string().uuid(),
    occupationKey: STABLE_KEY,
  })
  .strict();

/** Authored descriptive source. Carries NO evidence strength or classification. */
export const overviewSourceSchema = z
  .object({
    sourceKey: STABLE_KEY,
    label: NON_BLANK.max(160),
    url: z.string().url(),
    checkedAt: ISO_DATE,
  })
  .strict();
export type OverviewSource = z.infer<typeof overviewSourceSchema>;

/** Authored salary context. Always attributed to one descriptive source. */
export const overviewSalarySchema = z
  .object({
    starterGbp: z.number().int().positive(),
    experiencedGbp: z.number().int().positive(),
    sourceKey: STABLE_KEY,
  })
  .strict()
  .refine((value) => value.experiencedGbp >= value.starterGbp, {
    message: "experiencedGbp must not be below starterGbp",
  });
export type OverviewSalary = z.infer<typeof overviewSalarySchema>;

export const overviewWorkPatternSchema = z
  .object({
    typicalHours: NON_BLANK.max(120),
    patternSummary: SENTENCE,
    sourceKey: STABLE_KEY,
  })
  .strict();
export type OverviewWorkPattern = z.infer<typeof overviewWorkPatternSchema>;

/**
 * Participant-facing copy for exactly one route declared by the bound Career
 * Pack. The `routeKey` is the pack's own stable key; no archetype or internal
 * composition code is ever surfaced.
 *
 * `sourceKeys` names the DESCRIPTIVE overview sources that support this route's
 * summary. They follow the bound Career Pack's own evidence provenance; they are
 * not an evidence grade, classification or participant eligibility statement.
 *
 * `verificationNote` exists for the narrow case where the existing provenance
 * genuinely supports no specific criteria for a declared route (the Scotland
 * electrotechnical verification route). It states that criteria require separate
 * verification. Exactly one of the two mechanisms is used per route.
 */
export const overviewRouteDisplaySchema = z
  .object({
    routeKey: STABLE_KEY,
    label: NON_BLANK.max(120),
    summary: SENTENCE,
    sourceKeys: z.array(STABLE_KEY).max(6).optional(),
    verificationNote: SENTENCE.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.sourceKeys ?? [];
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate route sourceKey" });
    }
    const hasSources = keys.length > 0;
    const hasNote = value.verificationNote !== undefined;
    if (hasSources === hasNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `route ${value.routeKey} must declare either sourceKeys or a verificationNote`,
      });
    }
  });
export type OverviewRouteDisplay = z.infer<typeof overviewRouteDisplaySchema>;

export const careerOverviewSchema = z
  .object({
    occupation: overviewOccupationRefSchema,
    displayTitle: NON_BLANK.max(120),
    summary: SENTENCE,
    salary: overviewSalarySchema,
    workPattern: overviewWorkPatternSchema,
    /** Narrative market context. Never a rating, score or promise of a vacancy. */
    marketContextSummary: SENTENCE,
    marketContextSourceKey: STABLE_KEY,
    dayToDay: z.array(SENTENCE).min(3).max(5),
    routeDisplays: z.array(overviewRouteDisplaySchema).min(1),
    appeal: BULLETS,
    challenges: BULLETS,
    sources: z.array(overviewSourceSchema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = new Set(value.sources.map((source) => source.sourceKey));
    if (keys.size !== value.sources.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate sourceKey" });
    }
    for (const [field, key] of [
      ["salary", value.salary.sourceKey],
      ["workPattern", value.workPattern.sourceKey],
      ["marketContext", value.marketContextSourceKey],
    ] as const) {
      if (!keys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} references unknown sourceKey ${key}`,
        });
      }
    }
    const routeKeys = new Set(value.routeDisplays.map((route) => route.routeKey));
    if (routeKeys.size !== value.routeDisplays.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate routeKey" });
    }
    for (const route of value.routeDisplays) {
      for (const key of route.sourceKeys ?? []) {
        if (!keys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `route ${route.routeKey} references unknown sourceKey ${key}`,
          });
        }
      }
    }
  });
export type CareerOverview = z.infer<typeof careerOverviewSchema>;

function deepFreeze<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  const object = value as unknown as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const child of Object.values(object)) deepFreeze(child, seen);
  return Object.isFrozen(object) ? value : (Object.freeze(object) as T);
}

/** Strict-parse and deep-freeze an authored overview set, keyed uniquely. */
export function parseCareerOverviews(input: readonly unknown[]): readonly CareerOverview[] {
  const parsed = input.map((entry) => careerOverviewSchema.parse(entry));
  const keys = new Set(parsed.map((entry) => entry.occupation.occupationKey));
  if (keys.size !== parsed.length) {
    throw new Error("career overview content declares a duplicate occupationKey");
  }
  return deepFreeze(parsed as readonly CareerOverview[], new WeakSet());
}

export function careerOverviewByOccupationKey(
  overviews: readonly CareerOverview[],
  occupationKey: string,
): CareerOverview | undefined {
  return overviews.find((entry) => entry.occupation.occupationKey === occupationKey);
}
