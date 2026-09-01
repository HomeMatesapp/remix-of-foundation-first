import {
  ROUTE_ARCHETYPE_CODES,
  ROUTE_ARCHETYPE_FRAMEWORK_VERSION,
  type RouteArchetypeCode,
} from "./codes";
import {
  routeArchetypeDefinitionSchema,
  type RouteArchetypeComposition,
  type RouteArchetypeDefinition,
  type RouteArchetypeRef,
} from "./schema";

const V = ROUTE_ARCHETYPE_FRAMEWORK_VERSION;

/**
 * Canonical registry of the currently governed archetype definitions.
 *
 * Order is the stable catalogue order declared in `codes.ts`.
 */
const DEFINITIONS: readonly RouteArchetypeDefinition[] = [
  {
    code: "regulated_undergraduate",
    version: V,
    stageKeys: [
      "entry_requirements",
      "approved_undergraduate_study",
      "professional_registration",
      "role_entry",
    ],
  },
  {
    code: "postgraduate_conversion",
    version: V,
    stageKeys: ["prior_higher_education", "conversion_study", "professional_or_role_entry"],
  },
  {
    code: "degree_apprenticeship",
    version: V,
    stageKeys: ["employer_entry", "degree_apprenticeship_training", "completion", "role_entry"],
  },
  {
    code: "apprenticeship",
    version: V,
    stageKeys: ["employer_entry", "apprenticeship_training", "completion", "role_entry"],
  },
  {
    code: "vocational_qualification",
    version: V,
    stageKeys: [
      "entry_requirements",
      "vocational_training",
      "qualification_or_competence",
      "role_entry",
    ],
  },
  {
    code: "licence_certification",
    version: V,
    stageKeys: [
      "prerequisites",
      "training_or_assessment",
      "licence_or_certification",
      "practice_entry",
    ],
  },
  {
    code: "portfolio_experience",
    version: V,
    stageKeys: ["foundation_skills", "portfolio_building", "experience_building", "role_entry"],
  },
  {
    code: "self_employed",
    version: V,
    stageKeys: ["skill_readiness", "business_setup", "client_or_market_entry", "ongoing_operation"],
  },
  {
    code: "employer_led_training",
    version: V,
    stageKeys: ["employer_entry", "workplace_training", "competence_confirmation", "progression"],
  },
  {
    code: "graduate_scheme",
    version: V,
    stageKeys: [
      "graduate_entry_requirements",
      "recruitment_process",
      "structured_scheme",
      "progression",
    ],
  },
  {
    code: "direct_employment",
    version: V,
    stageKeys: ["baseline_requirements", "recruitment", "employment", "progression"],
  },
  {
    code: "experience_led_progression",
    version: V,
    stageKeys: [
      "entry_or_adjacent_role",
      "experience_building",
      "responsibility_progression",
      "target_role",
    ],
  },
  {
    code: "bridging",
    version: V,
    stageKeys: ["gap_identification", "bridge_step", "requirement_recheck", "target_route_handoff"],
  },
  {
    code: "regulator_verification",
    version: V,
    stageKeys: ["evidence_preparation", "regulator_submission", "verification", "next_step"],
  },
];

/**
 * Freeze a validated definition (and its stage-key array) so that a caller
 * cannot mutate the canonical in-memory registry, even via casting.
 */
function freezeDefinition(definition: RouteArchetypeDefinition): RouteArchetypeDefinition {
  Object.freeze(definition.stageKeys);
  return Object.freeze(definition);
}

/** Self-validation at module load: fail closed on a malformed catalogue. */
const validated: readonly RouteArchetypeDefinition[] = Object.freeze(
  DEFINITIONS.map((definition) =>
    freezeDefinition(routeArchetypeDefinitionSchema.parse(definition)),
  ),
);

if (validated.length !== ROUTE_ARCHETYPE_CODES.length) {
  throw new Error("route archetype registry must define every current code");
}

const byCode = new Map<RouteArchetypeCode, RouteArchetypeDefinition>();
for (const definition of validated) {
  if (byCode.has(definition.code)) {
    throw new Error(`duplicate route archetype code: ${definition.code}`);
  }
  byCode.set(definition.code, definition);
}

for (const code of ROUTE_ARCHETYPE_CODES) {
  if (!byCode.has(code)) {
    throw new Error(`missing route archetype definition: ${code}`);
  }
}

/** All current definitions, in stable catalogue order. */
export function listCurrentRouteArchetypes(): readonly RouteArchetypeDefinition[] {
  return Object.freeze(ROUTE_ARCHETYPE_CODES.map((code) => byCode.get(code)!));
}

/**
 * Exact resolution by code + version. Returns `undefined` for an unknown code
 * or a version that is not the current framework version. No alias mapping and
 * no inference from occupation or route title.
 */
export function resolveRouteArchetype(
  code: string,
  version: string,
): RouteArchetypeDefinition | undefined {
  const definition = byCode.get(code as RouteArchetypeCode);
  if (!definition || definition.version !== version) return undefined;
  return definition;
}

/** Whether an archetype reference resolves exactly. */
export function isKnownRouteArchetypeRef(ref: RouteArchetypeRef): boolean {
  return resolveRouteArchetype(ref.code, ref.version) !== undefined;
}

/**
 * Resolve every reference in a composition, in order. Returns `undefined` if any
 * reference does not resolve exactly.
 */
export function resolveRouteArchetypeComposition(
  composition: RouteArchetypeComposition,
): readonly RouteArchetypeDefinition[] | undefined {
  const resolved: RouteArchetypeDefinition[] = [];
  for (const ref of composition.archetypes) {
    const definition = resolveRouteArchetype(ref.code, ref.version);
    if (!definition) return undefined;
    resolved.push(definition);
  }
  return resolved;
}
