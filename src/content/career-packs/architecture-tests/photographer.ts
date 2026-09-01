import { parseCanonicalCareerPack, type CareerPack } from "../../../domain/career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../../domain/career-packs/version";
import type { QuestionRef } from "../../../domain/questions";
import { evidenceReference } from "./sources";

/**
 * ARCHITECTURE-TEST Career Pack — Photographer (UK, unregulated).
 *
 * Modelling notes that matter for the architecture:
 * - There is NO regulator and NO statutory entry requirement, so this pack
 *   declares no mandatory eligibility requirement at all. Portfolio strength,
 *   equipment access and working patterns are practical fit, barriers and
 *   ranking — never invented eligibility law.
 * - Portfolio and work-pattern guidance is graded B / `general_guidance`, so the
 *   shared engine's evidence ceiling holds those states at
 *   `verification_required` instead of manufacturing certainty.
 * - The apprenticeship portfolio gateway is a normal milestone of that route and
 *   is declared `contextual`, never a precondition that closes the route.
 */

const PACK_ID = "9a1e0004-0004-4000-8000-000000000004";

const ARCHETYPE_VERSION = "1.0.0" as const;
const MODULE_FRAMEWORK_VERSION = "1.0.0" as const;

function qref(moduleCode: string, questionKey: string): QuestionRef {
  return { moduleCode, questionKey } as QuestionRef;
}

const Q_PORTFOLIO = qref("portfolio", "portfolio_maturity");
const Q_EQUIPMENT = qref("portfolio", "equipment_access");
const Q_PAID_EXPERIENCE = qref("experience", "paid_photography_experience");
const Q_SELF_EMPLOYMENT = qref("employment_income", "self_employment_readiness");
const Q_BUSINESS_ADMIN = qref("employment_income", "business_admin_readiness");
const Q_VARIABLE_HOURS = qref("physical_work_pattern", "variable_hours_tolerance");
const Q_APPRENTICESHIP_INTEREST = qref("study_availability", "apprenticeship_interest");
const Q_HIGHER_EDUCATION_INTEREST = qref("study_availability", "higher_education_interest");

const EVIDENCE = [
  {
    evidenceKey: "ev_ncs_photographer",
    reference: evidenceReference(
      "national_careers_service",
      "ncs_photographer",
      "B",
      "general_guidance",
    ),
  },
  {
    evidenceKey: "ev_skills_england_st1388",
    reference: evidenceReference(
      "skills_england",
      "skills_england_st1388",
      "A",
      "confirmed_requirement",
    ),
  },
];

export const PHOTOGRAPHER_PACK: CareerPack = parseCanonicalCareerPack({
  schemaVersion: CAREER_PACK_SCHEMA_VERSION,
  careerPackId: PACK_ID,
  version: "1.0.0",
  occupation: { occupationKey: "photographer" },

  questionModules: [
    {
      moduleCode: "portfolio",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_PORTFOLIO.questionKey,
          moduleCode: "portfolio",
          input: { kind: "single_select", optionKeys: ["none", "developing", "strong"] },
          consequences: ["practical_fit", "route_ranking", "barrier", "next_action"],
        },
        {
          questionKey: Q_EQUIPMENT.questionKey,
          moduleCode: "portfolio",
          input: { kind: "single_select", optionKeys: ["adequate", "limited", "none"] },
          consequences: ["practical_fit", "barrier", "next_action"],
        },
      ],
    },
    {
      moduleCode: "experience",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_PAID_EXPERIENCE.questionKey,
          moduleCode: "experience",
          input: { kind: "single_select", optionKeys: ["none", "some", "substantial"] },
          consequences: ["route_ranking"],
        },
      ],
    },
    {
      moduleCode: "employment_income",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_SELF_EMPLOYMENT.questionKey,
          moduleCode: "employment_income",
          input: { kind: "single_select", optionKeys: ["ready", "not_ready", "unsure"] },
          consequences: ["practical_fit", "route_ranking", "unresolved_check", "next_action"],
        },
        {
          questionKey: Q_BUSINESS_ADMIN.questionKey,
          moduleCode: "employment_income",
          input: { kind: "single_select", optionKeys: ["ready", "not_ready", "unsure"] },
          consequences: ["practical_fit", "route_ranking", "unresolved_check"],
        },
      ],
    },
    {
      moduleCode: "physical_work_pattern",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_VARIABLE_HOURS.questionKey,
          moduleCode: "physical_work_pattern",
          input: { kind: "single_select", optionKeys: ["able", "unable", "unsure"] },
          consequences: ["practical_fit"],
        },
      ],
    },
    {
      moduleCode: "study_availability",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_APPRENTICESHIP_INTEREST.questionKey,
          moduleCode: "study_availability",
          input: { kind: "single_select", optionKeys: ["seeking", "not_seeking"] },
          consequences: ["route_availability", "route_ranking", "next_action"],
        },
        {
          questionKey: Q_HIGHER_EDUCATION_INTEREST.questionKey,
          moduleCode: "study_availability",
          input: { kind: "single_select", optionKeys: ["seeking", "not_seeking"] },
          consequences: ["route_availability", "route_ranking"],
        },
      ],
    },
  ],

  routes: [
    {
      routeKey: "route_portfolio_experience",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "portfolio_experience", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: [
        "req_portfolio_evidence",
        "req_variable_hours_tolerance",
        "req_equipment_access",
      ],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_photographer_apprenticeship",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "apprenticeship", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: [
        "req_apprenticeship_portfolio_gateway",
        "req_variable_hours_tolerance",
      ],
      availabilityRuleKeys: ["ar_apprenticeship_not_sought"],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_higher_education_photography",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "vocational_qualification", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: ["req_variable_hours_tolerance"],
      availabilityRuleKeys: ["ar_higher_education_not_sought"],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_assistant_toward_photographer",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [
          { code: "direct_employment", version: ARCHETYPE_VERSION },
          { code: "bridging", version: ARCHETYPE_VERSION },
        ],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: ["req_variable_hours_tolerance", "req_equipment_access"],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_self_employed_photographer",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "self_employed", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: [
        "req_self_employment_readiness",
        "req_business_admin_readiness",
        "req_portfolio_evidence",
        "req_equipment_access",
      ],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
  ],

  requirements: [
    {
      requirementKey: "req_portfolio_evidence",
      severity: "preferred",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_ncs_photographer"],
    },
    {
      /* Normal milestone of the apprenticeship, not an entry precondition. */
      requirementKey: "req_apprenticeship_portfolio_gateway",
      severity: "contextual",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_skills_england_st1388"],
    },
    {
      requirementKey: "req_variable_hours_tolerance",
      severity: "preferred",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_ncs_photographer"],
    },
    {
      requirementKey: "req_equipment_access",
      severity: "preferred",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_ncs_photographer"],
    },
    {
      requirementKey: "req_self_employment_readiness",
      severity: "mandatory",
      purposes: ["practical_fit"],
      evidenceKeys: [],
    },
    {
      requirementKey: "req_business_admin_readiness",
      severity: "mandatory",
      purposes: ["practical_fit"],
      evidenceKeys: [],
    },
  ],

  requirementRules: [
    {
      ruleKey: "rr_portfolio_strong",
      requirementKey: "req_portfolio_evidence",
      when: { question: Q_PORTFOLIO, operator: "equals", value: "strong" },
      state: "met",
    },
    {
      ruleKey: "rr_portfolio_developing",
      requirementKey: "req_portfolio_evidence",
      when: { question: Q_PORTFOLIO, operator: "equals", value: "developing" },
      state: "unmet",
    },
    {
      ruleKey: "rr_portfolio_none",
      requirementKey: "req_portfolio_evidence",
      when: { question: Q_PORTFOLIO, operator: "equals", value: "none" },
      state: "unmet",
    },

    {
      ruleKey: "rr_apprenticeship_gateway_portfolio_present",
      requirementKey: "req_apprenticeship_portfolio_gateway",
      when: { question: Q_PORTFOLIO, operator: "not_equals", value: "none" },
      state: "met",
    },
    {
      ruleKey: "rr_apprenticeship_gateway_portfolio_absent",
      requirementKey: "req_apprenticeship_portfolio_gateway",
      when: { question: Q_PORTFOLIO, operator: "equals", value: "none" },
      state: "unmet",
    },

    {
      ruleKey: "rr_variable_hours_able",
      requirementKey: "req_variable_hours_tolerance",
      when: { question: Q_VARIABLE_HOURS, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_variable_hours_unable",
      requirementKey: "req_variable_hours_tolerance",
      when: { question: Q_VARIABLE_HOURS, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_variable_hours_unsure",
      requirementKey: "req_variable_hours_tolerance",
      when: { question: Q_VARIABLE_HOURS, operator: "equals", value: "unsure" },
      state: "unknown",
    },

    {
      ruleKey: "rr_equipment_adequate",
      requirementKey: "req_equipment_access",
      when: { question: Q_EQUIPMENT, operator: "equals", value: "adequate" },
      state: "met",
    },
    {
      ruleKey: "rr_equipment_limited",
      requirementKey: "req_equipment_access",
      when: { question: Q_EQUIPMENT, operator: "equals", value: "limited" },
      state: "unmet",
    },
    {
      ruleKey: "rr_equipment_none",
      requirementKey: "req_equipment_access",
      when: { question: Q_EQUIPMENT, operator: "equals", value: "none" },
      state: "unmet",
    },

    {
      ruleKey: "rr_self_employment_ready",
      requirementKey: "req_self_employment_readiness",
      when: { question: Q_SELF_EMPLOYMENT, operator: "equals", value: "ready" },
      state: "met",
    },
    {
      ruleKey: "rr_self_employment_not_ready",
      requirementKey: "req_self_employment_readiness",
      when: { question: Q_SELF_EMPLOYMENT, operator: "equals", value: "not_ready" },
      state: "unmet",
    },
    {
      ruleKey: "rr_self_employment_unsure",
      requirementKey: "req_self_employment_readiness",
      when: { question: Q_SELF_EMPLOYMENT, operator: "equals", value: "unsure" },
      state: "unknown",
    },

    {
      ruleKey: "rr_business_admin_ready",
      requirementKey: "req_business_admin_readiness",
      when: { question: Q_BUSINESS_ADMIN, operator: "equals", value: "ready" },
      state: "met",
    },
    {
      ruleKey: "rr_business_admin_not_ready",
      requirementKey: "req_business_admin_readiness",
      when: { question: Q_BUSINESS_ADMIN, operator: "equals", value: "not_ready" },
      state: "unmet",
    },
    {
      ruleKey: "rr_business_admin_unsure",
      requirementKey: "req_business_admin_readiness",
      when: { question: Q_BUSINESS_ADMIN, operator: "equals", value: "unsure" },
      state: "unknown",
    },
  ],

  routeAvailabilityRules: [
    {
      ruleKey: "ar_apprenticeship_not_sought",
      routeKey: "route_photographer_apprenticeship",
      when: { question: Q_APPRENTICESHIP_INTEREST, operator: "equals", value: "not_seeking" },
      available: false,
    },
    {
      ruleKey: "ar_higher_education_not_sought",
      routeKey: "route_higher_education_photography",
      when: { question: Q_HIGHER_EDUCATION_INTEREST, operator: "equals", value: "not_seeking" },
      available: false,
    },
  ],

  barriers: [
    {
      barrierKey: "barrier_no_portfolio_for_direct_routes",
      blocking: false,
      relatedRequirementKeys: ["req_portfolio_evidence"],
      relatedRouteKeys: ["route_portfolio_experience", "route_self_employed_photographer"],
      evidenceKeys: ["ev_ncs_photographer"],
    },
    {
      barrierKey: "barrier_no_equipment_access",
      blocking: false,
      relatedRequirementKeys: ["req_equipment_access"],
      relatedRouteKeys: [
        "route_portfolio_experience",
        "route_assistant_toward_photographer",
        "route_self_employed_photographer",
      ],
      evidenceKeys: ["ev_ncs_photographer"],
    },
  ],

  barrierRules: [
    {
      ruleKey: "br_no_portfolio",
      barrierKey: "barrier_no_portfolio_for_direct_routes",
      when: { question: Q_PORTFOLIO, operator: "equals", value: "none" },
    },
    {
      ruleKey: "br_no_equipment_access",
      barrierKey: "barrier_no_equipment_access",
      when: { question: Q_EQUIPMENT, operator: "equals", value: "none" },
    },
  ],

  unresolvedChecks: [
    {
      checkKey: "check_portfolio_strength_review",
      relatedRequirementKeys: ["req_portfolio_evidence"],
      relatedRouteKeys: ["route_portfolio_experience", "route_self_employed_photographer"],
      explanationKey: "explain.portfolio_strength_is_judged_by_clients_not_by_rule",
    },
    {
      checkKey: "check_self_employment_readiness_review",
      relatedRequirementKeys: ["req_self_employment_readiness", "req_business_admin_readiness"],
      relatedRouteKeys: ["route_self_employed_photographer"],
      explanationKey: "explain.self_employment_readiness_unresolved",
    },
  ],

  unresolvedCheckRules: [
    {
      ruleKey: "cr_portfolio_strength_review",
      checkKey: "check_portfolio_strength_review",
      when: { question: Q_PORTFOLIO, operator: "equals", value: "developing" },
    },
    {
      ruleKey: "cr_self_employment_readiness_review",
      checkKey: "check_self_employment_readiness_review",
      when: {
        any: [
          { question: Q_SELF_EMPLOYMENT, operator: "equals", value: "unsure" },
          { question: Q_BUSINESS_ADMIN, operator: "equals", value: "unsure" },
        ],
      },
    },
  ],

  actions: [
    {
      actionKey: "action_build_photography_portfolio",
      relatedRouteKeys: ["route_portfolio_experience", "route_assistant_toward_photographer"],
      relatedRequirementKeys: ["req_portfolio_evidence"],
      relatedBarrierKeys: ["barrier_no_portfolio_for_direct_routes"],
      relatedUnresolvedCheckKeys: ["check_portfolio_strength_review"],
      evidenceKeys: ["ev_ncs_photographer"],
    },
    {
      actionKey: "action_plan_self_employment_finances",
      relatedRouteKeys: ["route_self_employed_photographer"],
      relatedRequirementKeys: ["req_self_employment_readiness", "req_business_admin_readiness"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_self_employment_readiness_review"],
      evidenceKeys: ["ev_ncs_photographer"],
    },
    {
      actionKey: "action_apply_photographer_apprenticeship",
      relatedRouteKeys: ["route_photographer_apprenticeship"],
      relatedRequirementKeys: ["req_apprenticeship_portfolio_gateway"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: [],
      evidenceKeys: ["ev_skills_england_st1388"],
    },
    {
      actionKey: "action_review_equipment_needs",
      relatedRouteKeys: [
        "route_portfolio_experience",
        "route_assistant_toward_photographer",
        "route_self_employed_photographer",
      ],
      relatedRequirementKeys: ["req_equipment_access"],
      relatedBarrierKeys: ["barrier_no_equipment_access"],
      relatedUnresolvedCheckKeys: [],
      evidenceKeys: ["ev_ncs_photographer"],
    },
  ],

  actionRules: [
    {
      ruleKey: "xr_build_portfolio",
      actionKey: "action_build_photography_portfolio",
      when: {
        any: [
          { question: Q_PORTFOLIO, operator: "equals", value: "none" },
          { question: Q_PORTFOLIO, operator: "equals", value: "developing" },
        ],
      },
    },
    {
      ruleKey: "xr_plan_self_employment_finances",
      actionKey: "action_plan_self_employment_finances",
      when: { question: Q_SELF_EMPLOYMENT, operator: "equals", value: "ready" },
    },
    {
      ruleKey: "xr_apply_photographer_apprenticeship",
      actionKey: "action_apply_photographer_apprenticeship",
      when: { question: Q_APPRENTICESHIP_INTEREST, operator: "equals", value: "seeking" },
    },
    {
      ruleKey: "xr_review_equipment_needs",
      actionKey: "action_review_equipment_needs",
      when: {
        any: [
          { question: Q_EQUIPMENT, operator: "equals", value: "limited" },
          { question: Q_EQUIPMENT, operator: "equals", value: "none" },
        ],
      },
    },
  ],

  evidence: EVIDENCE,

  rankingConfigs: [
    {
      rankingConfigKey: "ranking_photographer_starting_point",
      factors: [
        {
          factorKey: "factor_self_employment_ready_with_strong_portfolio",
          preferWhen: {
            all: [
              { question: Q_PORTFOLIO, operator: "equals", value: "strong" },
              { question: Q_SELF_EMPLOYMENT, operator: "equals", value: "ready" },
              { question: Q_BUSINESS_ADMIN, operator: "equals", value: "ready" },
            ],
          },
          routeKeys: ["route_self_employed_photographer"],
        },
        {
          factorKey: "factor_strong_portfolio_or_paid_experience",
          preferWhen: {
            any: [
              { question: Q_PORTFOLIO, operator: "equals", value: "strong" },
              { question: Q_PAID_EXPERIENCE, operator: "equals", value: "substantial" },
            ],
          },
          routeKeys: ["route_portfolio_experience"],
        },
        {
          factorKey: "factor_apprenticeship_chosen",
          preferWhen: {
            question: Q_APPRENTICESHIP_INTEREST,
            operator: "equals",
            value: "seeking",
          },
          routeKeys: ["route_photographer_apprenticeship"],
        },
        {
          factorKey: "factor_education_or_assistant_when_portfolio_immature",
          preferWhen: {
            any: [
              { question: Q_PORTFOLIO, operator: "equals", value: "none" },
              { question: Q_PORTFOLIO, operator: "equals", value: "developing" },
            ],
          },
          routeKeys: ["route_higher_education_photography", "route_assistant_toward_photographer"],
        },
      ],
    },
  ],

  localRequirements: [],

  review: {},

  scenarios: [
    {
      /* Strong portfolio and substantial paid experience, self-employment
       * readiness genuinely unresolved. Portfolio strength stays a judgement
       * for clients, not a rule. */
      scenarioKey: "scenario_strong_portfolio_experience_route",
      answers: [
        { question: Q_PORTFOLIO, value: "strong" },
        { question: Q_EQUIPMENT, value: "adequate" },
        { question: Q_PAID_EXPERIENCE, value: "substantial" },
        { question: Q_SELF_EMPLOYMENT, value: "unsure" },
        { question: Q_BUSINESS_ADMIN, value: "unsure" },
        { question: Q_VARIABLE_HOURS, value: "able" },
        { question: Q_APPRENTICESHIP_INTEREST, value: "not_seeking" },
        { question: Q_HIGHER_EDUCATION_INTEREST, value: "not_seeking" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_practical_fit_is",
          routeKey: "route_portfolio_experience",
          practicalFit: true,
        },
        {
          kind: "route_practical_fit_is",
          routeKey: "route_self_employed_photographer",
          practicalFit: null,
        },
        { kind: "unresolved_check_present", checkKey: "check_portfolio_strength_review" },
        { kind: "unresolved_check_present", checkKey: "check_self_employment_readiness_review" },
      ],
    },
    {
      /* Ready to trade: the self-employed route is a practical fit. */
      scenarioKey: "scenario_self_employment_ready",
      answers: [
        { question: Q_PORTFOLIO, value: "strong" },
        { question: Q_EQUIPMENT, value: "adequate" },
        { question: Q_PAID_EXPERIENCE, value: "substantial" },
        { question: Q_SELF_EMPLOYMENT, value: "ready" },
        { question: Q_BUSINESS_ADMIN, value: "ready" },
        { question: Q_VARIABLE_HOURS, value: "able" },
        { question: Q_APPRENTICESHIP_INTEREST, value: "not_seeking" },
        { question: Q_HIGHER_EDUCATION_INTEREST, value: "not_seeking" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_practical_fit_is",
          routeKey: "route_self_employed_photographer",
          practicalFit: true,
        },
        { kind: "action_present", actionKey: "action_plan_self_employment_finances" },
      ],
    },
    {
      /* No portfolio yet: training and assistant routes remain genuinely open,
       * and the missing portfolio is a non-blocking barrier plus an action. */
      scenarioKey: "scenario_no_portfolio_training_routes",
      answers: [
        { question: Q_PORTFOLIO, value: "none" },
        { question: Q_EQUIPMENT, value: "limited" },
        { question: Q_PAID_EXPERIENCE, value: "none" },
        { question: Q_SELF_EMPLOYMENT, value: "not_ready" },
        { question: Q_BUSINESS_ADMIN, value: "not_ready" },
        { question: Q_VARIABLE_HOURS, value: "able" },
        { question: Q_APPRENTICESHIP_INTEREST, value: "seeking" },
        { question: Q_HIGHER_EDUCATION_INTEREST, value: "seeking" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_practical_fit_is",
          routeKey: "route_photographer_apprenticeship",
          practicalFit: true,
        },
        {
          kind: "route_practical_fit_is",
          routeKey: "route_self_employed_photographer",
          practicalFit: false,
        },
        { kind: "barrier_present", barrierKey: "barrier_no_portfolio_for_direct_routes" },
        { kind: "action_present", actionKey: "action_build_photography_portfolio" },
      ],
    },
    {
      /* No equipment and no tolerance for variable hours: real conditions, held
       * at verification because the only evidence is general guidance. */
      scenarioKey: "scenario_equipment_and_hours_conditions",
      answers: [
        { question: Q_PORTFOLIO, value: "developing" },
        { question: Q_EQUIPMENT, value: "none" },
        { question: Q_PAID_EXPERIENCE, value: "some" },
        { question: Q_SELF_EMPLOYMENT, value: "unsure" },
        { question: Q_BUSINESS_ADMIN, value: "unsure" },
        { question: Q_VARIABLE_HOURS, value: "unable" },
        { question: Q_APPRENTICESHIP_INTEREST, value: "not_seeking" },
        { question: Q_HIGHER_EDUCATION_INTEREST, value: "not_seeking" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        { kind: "barrier_present", barrierKey: "barrier_no_equipment_access" },
        { kind: "action_present", actionKey: "action_review_equipment_needs" },
        {
          kind: "requirement_state_is",
          requirementKey: "req_equipment_access",
          state: "verification_required",
        },
      ],
    },
  ],
});
