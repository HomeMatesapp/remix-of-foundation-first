/**
 * Canonical current reusable Question Module catalogue.
 *
 * These are INTERNAL machine codes. They are never participant-facing section
 * titles. The catalogue is governed but not permanently exhaustive: adding,
 * removing or renaming a module is a governed framework change (framework
 * version bump), never an ad-hoc string.
 *
 * Deliberately NOT a PostgreSQL enum or table.
 */
export const QUESTION_MODULE_CODES = Object.freeze([
  "qualifications",
  "experience",
  "employment_income",
  "study_availability",
  "finance",
  "postcode_geography",
  "travel_relocation",
  "caring_practical",
  "driving",
  "portfolio",
  "registration",
  "background_checks",
  "physical_work_pattern",
] as const);

export type QuestionModuleCode = (typeof QUESTION_MODULE_CODES)[number];

/** Version of the Question Module framework itself. */
export const QUESTION_MODULE_FRAMEWORK_VERSION = "1.0.0" as const;

/**
 * Approved consequential purposes.
 *
 * A declaration means only "this answer is allowed to matter for this purpose
 * later". It carries no evaluation logic, score, weight, verdict or rule.
 */
export const QUESTION_CONSEQUENCE_CODES = Object.freeze([
  "eligibility",
  "practical_fit",
  "route_availability",
  "route_ranking",
  "barrier",
  "unresolved_check",
  "next_action",
] as const);

export type QuestionConsequenceCode = (typeof QUESTION_CONSEQUENCE_CODES)[number];

/** Generic structural input kinds. Data shapes only — never UI components. */
export const QUESTION_INPUT_KINDS = Object.freeze([
  "boolean",
  "single_select",
  "multi_select",
  "integer",
  "decimal",
  "text",
  "date",
] as const);

export type QuestionInputKind = (typeof QUESTION_INPUT_KINDS)[number];
