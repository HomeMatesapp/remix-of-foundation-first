import { z } from "zod";

import { semanticVersionSchema, stableKeySchema } from "../contracts";
import { ROUTE_ARCHETYPE_CODES, ROUTE_ARCHETYPE_FRAMEWORK_VERSION } from "./codes";

/**
 * Archetype code validator, backed by the governed TypeScript catalogue.
 * Unknown codes fail closed; no alias mapping, no fuzzy matching.
 */
export const routeArchetypeCodeSchema = z.enum(ROUTE_ARCHETYPE_CODES);

/**
 * Internal structural stage key.
 *
 * Scaffolding only. A stage key carries no policy: no eligibility threshold,
 * grade, provider rule, evidence strength, question, ranking weight, cost,
 * duration, salary, local availability, action or participant-facing copy.
 */
export const routeArchetypeStageKeySchema = stableKeySchema;

/**
 * Minimal immutable reference to an archetype: exactly what is needed to
 * identify which governed skeleton is being referred to, and at which framework
 * version.
 */
export const routeArchetypeRefSchema = z
  .object({
    code: routeArchetypeCodeSchema,
    // Pinned: the CURRENT reference contract is exact and fails closed. There is
    // exactly one governed framework version in this increment.
    version: z.literal(ROUTE_ARCHETYPE_FRAMEWORK_VERSION),
  })
  .strict();
export type RouteArchetypeRef = z.infer<typeof routeArchetypeRefSchema>;

/**
 * Reusable internal route skeleton definition.
 *
 * Structural fields only. `.strict()` so that any attempt to smuggle policy
 * vocabulary (required, blocking, severity, weight, score, condition, rule,
 * question, evidence, label, copy) fails validation.
 */
export const routeArchetypeDefinitionSchema = z
  .object({
    code: routeArchetypeCodeSchema,
    version: semanticVersionSchema,
    stageKeys: z
      .array(routeArchetypeStageKeySchema)
      .min(1, "must have at least one stage key")
      .refine(
        (keys) => new Set(keys).size === keys.length,
        "stage keys must be unique within an archetype",
      ),
  })
  .strict();
export type RouteArchetypeDefinition = z.infer<typeof routeArchetypeDefinitionSchema>;

/**
 * Ordered archetype composition.
 *
 * Represents that a content author has explicitly chosen to describe a route's
 * structure by composing one or more governed skeletons — for example a
 * `bridging` skeleton followed by another route structure.
 *
 * Carries no occupation data, route display name, eligibility logic, questions,
 * evidence, ranking, actions or participant-facing text.
 *
 * Absence of a suitable archetype is preferable to forcing a wrong one. Whether
 * a later Career Pack must supply a composition at all is decided in a later
 * increment, not here.
 */
export const routeArchetypeCompositionSchema = z
  .object({
    frameworkVersion: z.literal(ROUTE_ARCHETYPE_FRAMEWORK_VERSION),
    archetypes: z
      .array(routeArchetypeRefSchema)
      .min(1, "must contain at least one archetype reference")
      .refine(
        (refs) => new Set(refs.map((r) => `${r.code}@${r.version}`)).size === refs.length,
        "must not contain duplicate identical archetype references",
      ),
  })
  .strict();
export type RouteArchetypeComposition = z.infer<typeof routeArchetypeCompositionSchema>;
