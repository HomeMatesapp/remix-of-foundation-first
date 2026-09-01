/**
 * Canonical current Route Archetype catalogue.
 *
 * These are INTERNAL machine codes. They are never participant-facing labels.
 *
 * This list is the currently governed catalogue, not a permanently exhaustive
 * taxonomy. Adding, removing or renaming an archetype is a governed framework
 * change (framework version bump), never an ad-hoc string.
 *
 * Deliberately NOT a PostgreSQL enum or table: route archetype stays a governed
 * text/code concept at the persistence layer.
 */
export const ROUTE_ARCHETYPE_CODES = Object.freeze([
  "regulated_undergraduate",
  "postgraduate_conversion",
  "degree_apprenticeship",
  "apprenticeship",
  "vocational_qualification",
  "licence_certification",
  "portfolio_experience",
  "self_employed",
  "employer_led_training",
  "graduate_scheme",
  "direct_employment",
  "experience_led_progression",
  "bridging",
  "regulator_verification",
] as const);

export type RouteArchetypeCode = (typeof ROUTE_ARCHETYPE_CODES)[number];

/** Version of the Route Archetype framework itself. */
export const ROUTE_ARCHETYPE_FRAMEWORK_VERSION = "1.0.0" as const;
