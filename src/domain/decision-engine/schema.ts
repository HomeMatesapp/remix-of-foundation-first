import { z } from "zod";

import { realityCheckResultSchema, routeRefSchema, stableKeySchema } from "../contracts";
import { DECISION_ENGINE_VERSION } from "./codes";

/**
 * Engine-local evaluation envelope.
 *
 * The frozen Increment 2 `realityCheckResultSchema` is NOT modified. This
 * envelope carries the two structural outputs the frozen result contract has no
 * field for — full declared-route availability (including unresolved) and the
 * canonical triggered action keys — without smuggling them into that contract.
 *
 * Strict throughout: no free text, no scores, no weights, no AI/model/prompt
 * metadata, no participant-facing copy.
 */

export const routeAvailabilityItemSchema = z
  .object({
    route: routeRefSchema,
    /** true = available, false = declared unavailable, null = unresolved. */
    available: z.boolean().nullable(),
  })
  .strict();
export type RouteAvailabilityItem = z.infer<typeof routeAvailabilityItemSchema>;

export const realityCheckEvaluationSchema = z
  .object({
    decisionEngineVersion: z.literal(DECISION_ENGINE_VERSION),
    /** Must parse through the existing frozen result contract. */
    result: realityCheckResultSchema,
    /** Every DECLARED pack route, in canonical route-key order. */
    routeAvailability: z.array(routeAvailabilityItemSchema),
    /** Canonical, de-duplicated triggered action keys. Definitions stay in the pack. */
    triggeredActionKeys: z.array(stableKeySchema),
  })
  .strict();
export type RealityCheckEvaluation = z.infer<typeof realityCheckEvaluationSchema>;
