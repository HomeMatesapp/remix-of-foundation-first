import {
  formatQuestionAddress,
  isCalendarDate,
  validateQuestionDefinitionSet,
  type QuestionAnswerValue,
  type QuestionDefinition,
  type QuestionInput,
  type QuestionRef,
} from "../questions";
import {
  PACK_LIST_OPERATORS,
  PACK_NUMERIC_OPERATORS,
  PACK_PRESENCE_OPERATORS,
  PACK_EQUALITY_OPERATORS,
  collectPackConditions,
  type PackCondition,
  type PackRule,
} from "./condition";
import { careerPackSchema, type CareerPack } from "./schema";

/**
 * Pure whole-document Career Pack integrity validation.
 *
 * Fails closed on referential and structural contradictions. It produces NO
 * assessment outcome: nothing here decides eligibility, judgement or ranking,
 * and nothing converts unknown or missing data into `unmet` or `false`.
 */

export type CareerPackIssueCode =
  | "invalid_pack_document"
  | "invalid_question_module_set"
  | "duplicate_key"
  | "duplicate_identity"
  | "missing_reference"
  | "reference_purpose_mismatch"
  | "reference_owner_mismatch"
  | "operator_input_incompatible"
  | "condition_value_incompatible"
  | "scenario_value_incompatible";

export interface CareerPackIssue {
  readonly code: CareerPackIssueCode;
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

export interface CareerPackValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CareerPackIssue[];
}

/* -------------------------------------------------------------------------- */
/* Structural value compatibility                                             */
/* -------------------------------------------------------------------------- */

function operatorAllowedForInput(
  operator: PackCondition["operator"],
  input: QuestionInput,
): boolean {
  if ((PACK_PRESENCE_OPERATORS as readonly string[]).includes(operator)) return true;
  if ((PACK_NUMERIC_OPERATORS as readonly string[]).includes(operator)) {
    return input.kind === "integer" || input.kind === "decimal";
  }
  if ((PACK_LIST_OPERATORS as readonly string[]).includes(operator)) {
    return input.kind === "multi_select";
  }
  if ((PACK_EQUALITY_OPERATORS as readonly string[]).includes(operator)) {
    return input.kind !== "multi_select";
  }
  return false;
}

function numericBoundsCheck(
  value: number,
  bounds: { min?: number | undefined; max?: number | undefined },
): true | string {
  if (bounds.min !== undefined && value < bounds.min) {
    return `value ${value} is below the referenced question's declared min ${bounds.min}`;
  }
  if (bounds.max !== undefined && value > bounds.max) {
    return `value ${value} is above the referenced question's declared max ${bounds.max}`;
  }
  return true;
}

/**
 * Could this value structurally be a CONFIRMED answer to this input?
 *
 * This is structural possibility only. It is not an eligibility threshold and
 * carries no policy.
 */
export function packAnswerValueCompatibleWithInput(
  value: QuestionAnswerValue,
  input: QuestionInput,
): true | string {
  switch (input.kind) {
    case "boolean":
      return typeof value === "boolean" ? true : "boolean question requires a boolean value";
    case "single_select":
      return typeof value === "string" && input.optionKeys.includes(value)
        ? true
        : "value must be one of the referenced question's option keys";
    case "multi_select": {
      if (!Array.isArray(value)) return "multi-select question requires a list of option keys";
      if (value.length === 0) {
        return "an empty list is treated as unanswered and can never be a confirmed answer";
      }
      if (new Set(value).size !== value.length) return "option keys must be unique";
      const unknown = value.find((key) => !input.optionKeys.includes(key));
      return unknown === undefined
        ? true
        : `value ${unknown} is not one of the referenced question's option keys`;
    }
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return "integer question requires an integer value";
      }
      return numericBoundsCheck(value, input);
    case "decimal":
      if (typeof value !== "number") return "decimal question requires a numeric value";
      return numericBoundsCheck(value, input);
    case "text": {
      if (typeof value !== "string") return "text question requires a string value";
      if (value.trim().length === 0) {
        return "blank text is treated as unanswered and can never be a confirmed answer";
      }
      if (input.minLength !== undefined && value.length < input.minLength) {
        return `value is shorter than the referenced question's declared minLength ${input.minLength}`;
      }
      if (input.maxLength !== undefined && value.length > input.maxLength) {
        return `value is longer than the referenced question's declared maxLength ${input.maxLength}`;
      }
      return true;
    }
    case "date":
      if (typeof value !== "string") return "date question requires a string value";
      return isCalendarDate(value)
        ? true
        : "date question requires a valid ISO calendar date in YYYY-MM-DD form";
  }
}

function conditionValueCompatible(condition: PackCondition, input: QuestionInput): true | string {
  if (!("value" in condition)) return true;
  const { value } = condition;

  if ((PACK_LIST_OPERATORS as readonly string[]).includes(condition.operator)) {
    if (input.kind !== "multi_select") return "list operator requires a multi-select question";
    if (typeof value !== "string" || !input.optionKeys.includes(value)) {
      return "value must be one of the referenced question's option keys";
    }
    return true;
  }

  if ((PACK_NUMERIC_OPERATORS as readonly string[]).includes(condition.operator)) {
    if (typeof value !== "number") return "numeric comparison requires a numeric value";
    if (input.kind === "integer" && !Number.isInteger(value)) {
      return "integer question requires an integer comparison value";
    }
    if (input.kind === "integer" || input.kind === "decimal") {
      return numericBoundsCheck(value, input);
    }
    return true;
  }

  return packAnswerValueCompatibleWithInput(value, input);
}

/* -------------------------------------------------------------------------- */
/* Whole-document validation                                                  */
/* -------------------------------------------------------------------------- */

function duplicates(keys: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) dupes.add(key);
    seen.add(key);
  }
  return [...dupes];
}

export function validateCareerPack(input: unknown): CareerPackValidationResult {
  const issues: CareerPackIssue[] = [];

  const parsed = careerPackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid_pack_document",
          message: parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
            .join("; "),
        },
      ],
    };
  }
  const pack: CareerPack = parsed.data;

  /* Embedded question definition set. */
  const moduleSet = validateQuestionDefinitionSet(pack.questionModules);
  if (!moduleSet.valid) {
    for (const issue of moduleSet.issues) {
      issues.push({
        code: "invalid_question_module_set",
        message: `${issue.code}: ${issue.message}`,
        ...(issue.at === undefined ? {} : { at: issue.at }),
      });
    }
  }

  const questions = new Map<string, QuestionDefinition>();
  for (const module of pack.questionModules) {
    for (const question of module.questions) {
      questions.set(formatQuestionAddress(question), question);
    }
  }

  /* Duplicate stable keys in every keyed collection. */
  const keyed: readonly [string, readonly string[]][] = [
    ["route", pack.routes.map((r) => r.routeKey)],
    ["requirement", pack.requirements.map((r) => r.requirementKey)],
    ["requirementRule", pack.requirementRules.map((r) => r.ruleKey)],
    ["routeAvailabilityRule", pack.routeAvailabilityRules.map((r) => r.ruleKey)],
    ["barrier", pack.barriers.map((b) => b.barrierKey)],
    ["barrierRule", pack.barrierRules.map((r) => r.ruleKey)],
    ["unresolvedCheck", pack.unresolvedChecks.map((c) => c.checkKey)],
    ["unresolvedCheckRule", pack.unresolvedCheckRules.map((r) => r.ruleKey)],
    ["action", pack.actions.map((a) => a.actionKey)],
    ["actionRule", pack.actionRules.map((r) => r.ruleKey)],
    ["evidence", pack.evidence.map((e) => e.evidenceKey)],
    ["rankingConfig", pack.rankingConfigs.map((c) => c.rankingConfigKey)],
    ["localRequirement", pack.localRequirements.map((l) => l.localRequirementKey)],
    ["scenario", pack.scenarios.map((s) => s.scenarioKey)],
  ];
  for (const [collection, keys] of keyed) {
    for (const key of duplicates(keys)) {
      issues.push({
        code: "duplicate_key",
        message: `duplicate ${collection} key ${key}`,
        at: `${collection}:${key}`,
      });
    }
  }

  /**
   * `ruleKey` is one canonical rule namespace across the whole pack. The same
   * stable rule key must never mean two different rules depending on which
   * collection it happens to sit in.
   */
  const allRuleKeys: readonly string[] = [
    ...pack.requirementRules.map((r) => r.ruleKey),
    ...pack.routeAvailabilityRules.map((r) => r.ruleKey),
    ...pack.barrierRules.map((r) => r.ruleKey),
    ...pack.unresolvedCheckRules.map((r) => r.ruleKey),
    ...pack.actionRules.map((r) => r.ruleKey),
  ];
  for (const key of duplicates(allRuleKeys)) {
    issues.push({
      code: "duplicate_key",
      message: `duplicate rule key ${key} in the canonical pack rule namespace`,
      at: `rule:${key}`,
    });
  }

  /* Duplicate optional UUID identities where supplied. */
  const identities: readonly [string, readonly string[]][] = [
    [
      "route",
      pack.routes.map((r) => r.routeId).filter((id): id is string => typeof id === "string"),
    ],
    [
      "requirement",
      pack.requirements
        .map((r) => r.requirementId)
        .filter((id): id is string => typeof id === "string"),
    ],
  ];
  for (const [collection, ids] of identities) {
    for (const id of duplicates(ids)) {
      issues.push({
        code: "duplicate_identity",
        message: `duplicate ${collection} id ${id}`,
        at: `${collection}:${id}`,
      });
    }
  }

  const routeKeys = new Set(pack.routes.map((r) => r.routeKey));
  const requirementKeys = new Set(pack.requirements.map((r) => r.requirementKey));
  const barrierKeys = new Set(pack.barriers.map((b) => b.barrierKey));
  const checkKeys = new Set(pack.unresolvedChecks.map((c) => c.checkKey));
  const actionKeys = new Set(pack.actions.map((a) => a.actionKey));
  const evidenceKeys = new Set(pack.evidence.map((e) => e.evidenceKey));
  const localRequirementKeys = new Set(pack.localRequirements.map((l) => l.localRequirementKey));
  const availabilityRuleKeys = new Set(pack.routeAvailabilityRules.map((r) => r.ruleKey));

  const requireRef = (
    present: ReadonlySet<string>,
    key: string,
    kind: string,
    at: string,
  ): void => {
    if (!present.has(key)) {
      issues.push({
        code: "missing_reference",
        message: `${at} references nonexistent ${kind} ${key}`,
        at,
      });
    }
  };

  /* Routes. */
  const requirementsByKey = new Map(pack.requirements.map((r) => [r.requirementKey, r]));
  const availabilityRulesByKey = new Map(pack.routeAvailabilityRules.map((r) => [r.ruleKey, r]));

  for (const route of pack.routes) {
    const at = `route:${route.routeKey}`;

    /**
     * A route may only list a requirement under a purpose the requirement
     * itself declares. This is structural coherence, not an assessment result:
     * nothing here decides eligibility or practical fit.
     */
    const purposeCoherent = (
      key: string,
      field: "eligibilityRequirementKeys" | "practicalFitRequirementKeys",
      purpose: "eligibility" | "practical_fit",
    ): void => {
      requireRef(requirementKeys, key, "requirement", at);
      const requirement = requirementsByKey.get(key);
      if (requirement && !requirement.purposes.includes(purpose)) {
        issues.push({
          code: "reference_purpose_mismatch",
          message: `${at}.${field} lists requirement ${key}, which does not declare the ${purpose} purpose`,
          at,
        });
      }
    };

    for (const key of route.eligibilityRequirementKeys) {
      purposeCoherent(key, "eligibilityRequirementKeys", "eligibility");
    }
    for (const key of route.practicalFitRequirementKeys) {
      purposeCoherent(key, "practicalFitRequirementKeys", "practical_fit");
    }
    for (const key of route.availabilityRuleKeys) {
      requireRef(availabilityRuleKeys, key, "route availability rule", at);
      const rule = availabilityRulesByKey.get(key);
      if (rule && rule.routeKey !== route.routeKey) {
        issues.push({
          code: "reference_owner_mismatch",
          message: `${at}.availabilityRuleKeys lists availability rule ${key}, which targets route ${rule.routeKey}`,
          at,
        });
      }
    }
    for (const key of route.localRequirementKeys) {
      requireRef(localRequirementKeys, key, "local requirement", at);
    }
  }

  /* Requirements + evidence refs. */
  for (const requirement of pack.requirements) {
    const at = `requirement:${requirement.requirementKey}`;
    for (const key of requirement.evidenceKeys) requireRef(evidenceKeys, key, "evidence", at);
  }

  /* Barriers. */
  for (const barrier of pack.barriers) {
    const at = `barrier:${barrier.barrierKey}`;
    for (const key of barrier.relatedRequirementKeys) {
      requireRef(requirementKeys, key, "requirement", at);
    }
    for (const key of barrier.relatedRouteKeys) requireRef(routeKeys, key, "route", at);
    for (const key of barrier.evidenceKeys) requireRef(evidenceKeys, key, "evidence", at);
  }

  /* Unresolved checks. */
  for (const check of pack.unresolvedChecks) {
    const at = `unresolvedCheck:${check.checkKey}`;
    for (const key of check.relatedRequirementKeys) {
      requireRef(requirementKeys, key, "requirement", at);
    }
    for (const key of check.relatedRouteKeys) requireRef(routeKeys, key, "route", at);
  }

  /* Actions. */
  for (const action of pack.actions) {
    const at = `action:${action.actionKey}`;
    for (const key of action.relatedRouteKeys) requireRef(routeKeys, key, "route", at);
    for (const key of action.relatedRequirementKeys) {
      requireRef(requirementKeys, key, "requirement", at);
    }
    for (const key of action.relatedBarrierKeys) requireRef(barrierKeys, key, "barrier", at);
    for (const key of action.relatedUnresolvedCheckKeys) {
      requireRef(checkKeys, key, "unresolved check", at);
    }
    for (const key of action.evidenceKeys) requireRef(evidenceKeys, key, "evidence", at);
  }

  /* Local requirements. */
  for (const local of pack.localRequirements) {
    const at = `localRequirement:${local.localRequirementKey}`;
    for (const key of local.relatedRouteKeys) requireRef(routeKeys, key, "route", at);
    if (typeof local.unresolvedCheckKey === "string") {
      requireRef(checkKeys, local.unresolvedCheckKey, "unresolved check", at);
    }
  }

  /* Rule targets + conditions. */
  const validateCondition = (rule: PackRule, at: string): void => {
    for (const condition of collectPackConditions(rule)) {
      const address = formatQuestionAddress(condition.question as QuestionRef);
      const question = questions.get(address);
      if (!question) {
        issues.push({
          code: "missing_reference",
          message: `${at} references nonexistent question ${address}`,
          at,
        });
        continue;
      }
      if (!operatorAllowedForInput(condition.operator, question.input)) {
        issues.push({
          code: "operator_input_incompatible",
          message: `${at}: operator ${condition.operator} is not valid for ${question.input.kind} question ${address}`,
          at,
        });
        continue;
      }
      const check = conditionValueCompatible(condition, question.input);
      if (check !== true) {
        issues.push({
          code: "condition_value_incompatible",
          message: `${at} -> ${address}: ${check}`,
          at,
        });
      }
    }
  };

  for (const rule of pack.requirementRules) {
    const at = `requirementRule:${rule.ruleKey}`;
    requireRef(requirementKeys, rule.requirementKey, "requirement", at);
    validateCondition(rule.when, at);
  }
  for (const rule of pack.routeAvailabilityRules) {
    const at = `routeAvailabilityRule:${rule.ruleKey}`;
    requireRef(routeKeys, rule.routeKey, "route", at);
    validateCondition(rule.when, at);
  }
  for (const rule of pack.barrierRules) {
    const at = `barrierRule:${rule.ruleKey}`;
    requireRef(barrierKeys, rule.barrierKey, "barrier", at);
    validateCondition(rule.when, at);
  }
  for (const rule of pack.unresolvedCheckRules) {
    const at = `unresolvedCheckRule:${rule.ruleKey}`;
    requireRef(checkKeys, rule.checkKey, "unresolved check", at);
    validateCondition(rule.when, at);
  }
  for (const rule of pack.actionRules) {
    const at = `actionRule:${rule.ruleKey}`;
    requireRef(actionKeys, rule.actionKey, "action", at);
    validateCondition(rule.when, at);
  }

  /* Ranking configurations. */
  for (const config of pack.rankingConfigs) {
    for (const factor of config.factors) {
      const at = `rankingFactor:${config.rankingConfigKey}/${factor.factorKey}`;
      for (const key of factor.routeKeys) requireRef(routeKeys, key, "route", at);
      validateCondition(factor.preferWhen, at);
    }
  }

  /* Scenarios. */
  for (const scenario of pack.scenarios) {
    const at = `scenario:${scenario.scenarioKey}`;
    const seenFixtures = new Set<string>();
    for (const fixture of scenario.answers) {
      const address = formatQuestionAddress(fixture.question as QuestionRef);
      if (seenFixtures.has(address)) {
        issues.push({
          code: "duplicate_key",
          message: `${at} declares duplicate fixture for question ${address}`,
          at,
        });
        continue;
      }
      seenFixtures.add(address);

      const question = questions.get(address);
      if (!question) {
        issues.push({
          code: "missing_reference",
          message: `${at} references nonexistent question ${address}`,
          at,
        });
        continue;
      }
      const check = packAnswerValueCompatibleWithInput(fixture.value, question.input);
      if (check !== true) {
        issues.push({
          code: "scenario_value_incompatible",
          message: `${at} -> ${address}: ${check}`,
          at,
        });
      }
    }

    for (const assertion of scenario.expect) {
      switch (assertion.kind) {
        case "judgement_is":
          break;
        case "requirement_state_is":
          requireRef(requirementKeys, assertion.requirementKey, "requirement", at);
          break;
        case "route_eligibility_is":
        case "route_practical_fit_is":
          requireRef(routeKeys, assertion.routeKey, "route", at);
          break;
        case "barrier_present":
          requireRef(barrierKeys, assertion.barrierKey, "barrier", at);
          break;
        case "unresolved_check_present":
          requireRef(checkKeys, assertion.checkKey, "unresolved check", at);
          break;
        case "action_present":
          requireRef(actionKeys, assertion.actionKey, "action", at);
          break;
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
