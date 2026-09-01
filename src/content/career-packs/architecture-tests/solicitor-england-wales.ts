import { parseCanonicalCareerPack, type CareerPack } from "../../../domain/career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../../domain/career-packs/version";
import type { QuestionRef } from "../../../domain/questions";
import { evidenceReference } from "./sources";

/**
 * ARCHITECTURE-TEST Career Pack — Solicitor of England and Wales (SRA).
 *
 * Jurisdiction is explicit: this pack models the SRA route to admission in
 * England and Wales only. It is not a generic "UK solicitor" pack.
 *
 * Modelling notes that matter for the architecture:
 * - Assessment and experience MILESTONES that are normal steps of a route (SQE1,
 *   SQE2, qualifying work experience) are declared with `contextual` severity, so
 *   an early-stage participant sees conditions to complete rather than a route
 *   that is unavailable before they have had the chance to complete it.
 * - Degree equivalence is an SRA DECISION, so an unproven equivalence is
 *   `verification_required`, never failure.
 * - Regulator suitability is a global unresolved matter, never a silent negative.
 */

const PACK_ID = "9a1e0003-0003-4000-8000-000000000003";

const ARCHETYPE_VERSION = "1.0.0" as const;
const MODULE_FRAMEWORK_VERSION = "1.0.0" as const;

function qref(moduleCode: string, questionKey: string): QuestionRef {
  return { moduleCode, questionKey } as QuestionRef;
}

const Q_DEGREE = qref("qualifications", "degree_or_equivalent_status");
const Q_SQE1 = qref("qualifications", "sqe1_status");
const Q_SQE2 = qref("qualifications", "sqe2_status");
const Q_LPC = qref("qualifications", "lpc_transitional_eligibility_status");
const Q_QWE_MONTHS = qref("experience", "qualifying_work_experience_months");
const Q_APPRENTICESHIP_START = qref("experience", "apprenticeship_starting_point");
const Q_SUITABILITY = qref("background_checks", "sra_suitability_status");
const Q_LEGAL_EMPLOYMENT = qref("employment_income", "legal_employment_status");

const EVIDENCE = [
  {
    evidenceKey: "ev_sra_sqe",
    reference: evidenceReference("sra", "sra_sqe", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_sra_sqe_qa",
    reference: evidenceReference("sra", "sra_sqe_qa", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_sra_degree_equivalent",
    reference: evidenceReference("sra", "sra_degree_equivalent", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_sra_qualifying_work_experience",
    reference: evidenceReference(
      "sra",
      "sra_qualifying_work_experience",
      "A",
      "confirmed_requirement",
    ),
  },
  {
    evidenceKey: "ev_sra_solicitor_apprenticeships",
    reference: evidenceReference(
      "sra",
      "sra_solicitor_apprenticeships",
      "A",
      "confirmed_requirement",
    ),
  },
  {
    evidenceKey: "ev_sra_pathways_to_qualification",
    reference: evidenceReference(
      "sra",
      "sra_pathways_to_qualification",
      "A",
      "confirmed_requirement",
    ),
  },
];

export const SOLICITOR_ENGLAND_WALES_PACK: CareerPack = parseCanonicalCareerPack({
  schemaVersion: CAREER_PACK_SCHEMA_VERSION,
  careerPackId: PACK_ID,
  version: "1.0.0",
  occupation: { occupationKey: "solicitor_england_wales" },

  questionModules: [
    {
      moduleCode: "qualifications",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_DEGREE.questionKey,
          moduleCode: "qualifications",
          input: {
            kind: "single_select",
            optionKeys: ["confirmed_level6_plus", "equivalence_needs_sra_decision", "none"],
          },
          consequences: ["eligibility", "unresolved_check", "barrier", "next_action"],
        },
        {
          questionKey: Q_SQE1.questionKey,
          moduleCode: "qualifications",
          input: { kind: "single_select", optionKeys: ["passed", "not_yet_taken"] },
          consequences: ["eligibility", "next_action"],
        },
        {
          questionKey: Q_SQE2.questionKey,
          moduleCode: "qualifications",
          input: { kind: "single_select", optionKeys: ["passed", "not_yet_taken"] },
          consequences: ["eligibility", "next_action"],
        },
        {
          questionKey: Q_LPC.questionKey,
          moduleCode: "qualifications",
          input: {
            kind: "single_select",
            optionKeys: ["confirmed_eligible", "not_eligible", "not_sure"],
          },
          consequences: ["eligibility", "route_availability", "unresolved_check", "next_action"],
        },
      ],
    },
    {
      moduleCode: "experience",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_QWE_MONTHS.questionKey,
          moduleCode: "experience",
          input: { kind: "integer", min: 0, max: 120, unitKey: "months" },
          consequences: ["eligibility", "next_action"],
        },
        {
          questionKey: Q_APPRENTICESHIP_START.questionKey,
          moduleCode: "experience",
          input: {
            kind: "single_select",
            optionKeys: ["non_graduate", "graduate", "not_seeking_apprenticeship"],
          },
          consequences: ["route_availability"],
        },
      ],
    },
    {
      moduleCode: "background_checks",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_SUITABILITY.questionKey,
          moduleCode: "background_checks",
          input: {
            kind: "single_select",
            optionKeys: ["no_known_issue", "issue_to_disclose", "regulator_cleared"],
          },
          consequences: ["eligibility", "unresolved_check", "next_action"],
        },
      ],
    },
    {
      moduleCode: "employment_income",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_LEGAL_EMPLOYMENT.questionKey,
          moduleCode: "employment_income",
          input: { kind: "single_select", optionKeys: ["in_legal_role", "offer_held", "none"] },
          consequences: ["practical_fit", "next_action"],
        },
      ],
    },
  ],

  routes: [
    {
      routeKey: "route_sqe_standard",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "regulator_verification", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [
        "req_degree_or_equivalent",
        "req_sra_suitability",
        "req_sqe1_passed",
        "req_sqe2_passed",
        "req_qualifying_work_experience",
      ],
      practicalFitRequirementKeys: ["req_legal_work_setting"],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_solicitor_apprenticeship_non_graduate",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "apprenticeship", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_sra_suitability", "req_sqe1_passed", "req_sqe2_passed"],
      practicalFitRequirementKeys: ["req_legal_work_setting"],
      availabilityRuleKeys: [
        "ar_non_graduate_apprenticeship_not_sought",
        "ar_non_graduate_apprenticeship_graduate_start",
      ],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_solicitor_apprenticeship_graduate",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "apprenticeship", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [
        "req_sra_suitability",
        "req_degree_or_equivalent",
        "req_sqe1_passed",
        "req_sqe2_passed",
      ],
      practicalFitRequirementKeys: ["req_legal_work_setting"],
      availabilityRuleKeys: [
        "ar_graduate_apprenticeship_not_sought",
        "ar_graduate_apprenticeship_non_graduate_start",
      ],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_lpc_transitional",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "regulator_verification", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_lpc_transitional_eligibility", "req_sra_suitability"],
      practicalFitRequirementKeys: [],
      availabilityRuleKeys: ["ar_lpc_transitional_scope"],
      localRequirementKeys: [],
    },
  ],

  requirements: [
    {
      requirementKey: "req_degree_or_equivalent",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_sra_sqe", "ev_sra_degree_equivalent"],
    },
    {
      requirementKey: "req_sra_suitability",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_sra_pathways_to_qualification"],
    },
    {
      /* Normal milestone of the route, never a precondition for starting it. */
      requirementKey: "req_sqe1_passed",
      severity: "contextual",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_sra_sqe"],
    },
    {
      requirementKey: "req_sqe2_passed",
      severity: "contextual",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_sra_sqe"],
    },
    {
      requirementKey: "req_qualifying_work_experience",
      severity: "contextual",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_sra_qualifying_work_experience"],
    },
    {
      requirementKey: "req_lpc_transitional_eligibility",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_sra_pathways_to_qualification"],
    },
    {
      /* Employer-dependent, therefore preferred and never blocking. */
      requirementKey: "req_legal_work_setting",
      severity: "preferred",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_sra_solicitor_apprenticeships"],
    },
  ],

  requirementRules: [
    {
      ruleKey: "rr_degree_confirmed",
      requirementKey: "req_degree_or_equivalent",
      when: { question: Q_DEGREE, operator: "equals", value: "confirmed_level6_plus" },
      state: "met",
    },
    {
      ruleKey: "rr_degree_equivalence_pending",
      requirementKey: "req_degree_or_equivalent",
      when: { question: Q_DEGREE, operator: "equals", value: "equivalence_needs_sra_decision" },
      state: "verification_required",
    },
    {
      ruleKey: "rr_degree_none",
      requirementKey: "req_degree_or_equivalent",
      when: { question: Q_DEGREE, operator: "equals", value: "none" },
      state: "unmet",
    },

    {
      ruleKey: "rr_suitability_no_known_issue",
      requirementKey: "req_sra_suitability",
      when: { question: Q_SUITABILITY, operator: "equals", value: "no_known_issue" },
      state: "met",
    },
    {
      ruleKey: "rr_suitability_regulator_cleared",
      requirementKey: "req_sra_suitability",
      when: { question: Q_SUITABILITY, operator: "equals", value: "regulator_cleared" },
      state: "met",
    },
    {
      ruleKey: "rr_suitability_issue_to_disclose",
      requirementKey: "req_sra_suitability",
      when: { question: Q_SUITABILITY, operator: "equals", value: "issue_to_disclose" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_sqe1_passed",
      requirementKey: "req_sqe1_passed",
      when: { question: Q_SQE1, operator: "equals", value: "passed" },
      state: "met",
    },
    {
      ruleKey: "rr_sqe1_not_yet_taken",
      requirementKey: "req_sqe1_passed",
      when: { question: Q_SQE1, operator: "equals", value: "not_yet_taken" },
      state: "unmet",
    },
    {
      ruleKey: "rr_sqe2_passed",
      requirementKey: "req_sqe2_passed",
      when: { question: Q_SQE2, operator: "equals", value: "passed" },
      state: "met",
    },
    {
      ruleKey: "rr_sqe2_not_yet_taken",
      requirementKey: "req_sqe2_passed",
      when: { question: Q_SQE2, operator: "equals", value: "not_yet_taken" },
      state: "unmet",
    },

    {
      ruleKey: "rr_qwe_complete",
      requirementKey: "req_qualifying_work_experience",
      when: { question: Q_QWE_MONTHS, operator: "gte", value: 24 },
      state: "met",
    },
    {
      ruleKey: "rr_qwe_incomplete",
      requirementKey: "req_qualifying_work_experience",
      when: { question: Q_QWE_MONTHS, operator: "lt", value: 24 },
      state: "unmet",
    },

    {
      ruleKey: "rr_lpc_transitional_confirmed",
      requirementKey: "req_lpc_transitional_eligibility",
      when: { question: Q_LPC, operator: "equals", value: "confirmed_eligible" },
      state: "met",
    },
    {
      ruleKey: "rr_lpc_transitional_not_eligible",
      requirementKey: "req_lpc_transitional_eligibility",
      when: { question: Q_LPC, operator: "equals", value: "not_eligible" },
      state: "unmet",
    },
    {
      ruleKey: "rr_lpc_transitional_unsure",
      requirementKey: "req_lpc_transitional_eligibility",
      when: { question: Q_LPC, operator: "equals", value: "not_sure" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_legal_work_setting_in_role",
      requirementKey: "req_legal_work_setting",
      when: { question: Q_LEGAL_EMPLOYMENT, operator: "equals", value: "in_legal_role" },
      state: "met",
    },
    {
      ruleKey: "rr_legal_work_setting_offer",
      requirementKey: "req_legal_work_setting",
      when: { question: Q_LEGAL_EMPLOYMENT, operator: "equals", value: "offer_held" },
      state: "met",
    },
    {
      ruleKey: "rr_legal_work_setting_none",
      requirementKey: "req_legal_work_setting",
      when: { question: Q_LEGAL_EMPLOYMENT, operator: "equals", value: "none" },
      state: "unmet",
    },
  ],

  routeAvailabilityRules: [
    {
      ruleKey: "ar_non_graduate_apprenticeship_not_sought",
      routeKey: "route_solicitor_apprenticeship_non_graduate",
      when: {
        question: Q_APPRENTICESHIP_START,
        operator: "equals",
        value: "not_seeking_apprenticeship",
      },
      available: false,
    },
    {
      ruleKey: "ar_non_graduate_apprenticeship_graduate_start",
      routeKey: "route_solicitor_apprenticeship_non_graduate",
      when: { question: Q_APPRENTICESHIP_START, operator: "equals", value: "graduate" },
      available: false,
    },
    {
      ruleKey: "ar_graduate_apprenticeship_not_sought",
      routeKey: "route_solicitor_apprenticeship_graduate",
      when: {
        question: Q_APPRENTICESHIP_START,
        operator: "equals",
        value: "not_seeking_apprenticeship",
      },
      available: false,
    },
    {
      ruleKey: "ar_graduate_apprenticeship_non_graduate_start",
      routeKey: "route_solicitor_apprenticeship_graduate",
      when: { question: Q_APPRENTICESHIP_START, operator: "equals", value: "non_graduate" },
      available: false,
    },
    {
      ruleKey: "ar_lpc_transitional_scope",
      routeKey: "route_lpc_transitional",
      when: { question: Q_LPC, operator: "equals", value: "not_eligible" },
      available: false,
    },
  ],

  barriers: [
    {
      barrierKey: "barrier_no_degree_or_equivalent_for_admission",
      blocking: true,
      relatedRequirementKeys: ["req_degree_or_equivalent"],
      relatedRouteKeys: ["route_sqe_standard", "route_solicitor_apprenticeship_graduate"],
      evidenceKeys: ["ev_sra_degree_equivalent"],
    },
  ],

  barrierRules: [
    {
      ruleKey: "br_no_degree_or_equivalent",
      barrierKey: "barrier_no_degree_or_equivalent_for_admission",
      when: { question: Q_DEGREE, operator: "equals", value: "none" },
    },
  ],

  unresolvedChecks: [
    {
      checkKey: "check_degree_equivalence_sra_decision",
      relatedRequirementKeys: ["req_degree_or_equivalent"],
      relatedRouteKeys: ["route_sqe_standard", "route_solicitor_apprenticeship_graduate"],
      explanationKey: "explain.regulator_decides_degree_equivalence",
    },
    {
      checkKey: "check_sra_suitability_disclosure",
      relatedRequirementKeys: ["req_sra_suitability"],
      relatedRouteKeys: [],
      explanationKey: "explain.regulator_reviews_suitability_disclosure",
    },
    {
      checkKey: "check_lpc_transitional_verification",
      relatedRequirementKeys: ["req_lpc_transitional_eligibility"],
      relatedRouteKeys: ["route_lpc_transitional"],
      explanationKey: "explain.regulator_confirms_transitional_eligibility",
    },
  ],

  unresolvedCheckRules: [
    {
      ruleKey: "cr_degree_equivalence_decision",
      checkKey: "check_degree_equivalence_sra_decision",
      when: { question: Q_DEGREE, operator: "equals", value: "equivalence_needs_sra_decision" },
    },
    {
      ruleKey: "cr_suitability_disclosure",
      checkKey: "check_sra_suitability_disclosure",
      when: { question: Q_SUITABILITY, operator: "equals", value: "issue_to_disclose" },
    },
    {
      ruleKey: "cr_lpc_transitional_verification",
      checkKey: "check_lpc_transitional_verification",
      when: { question: Q_LPC, operator: "equals", value: "not_sure" },
    },
  ],

  actions: [
    {
      actionKey: "action_book_sqe1",
      relatedRouteKeys: [
        "route_sqe_standard",
        "route_solicitor_apprenticeship_non_graduate",
        "route_solicitor_apprenticeship_graduate",
      ],
      relatedRequirementKeys: ["req_sqe1_passed"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: [],
      evidenceKeys: ["ev_sra_sqe"],
    },
    {
      actionKey: "action_book_sqe2",
      relatedRouteKeys: ["route_sqe_standard"],
      relatedRequirementKeys: ["req_sqe2_passed"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: [],
      evidenceKeys: ["ev_sra_sqe_qa"],
    },
    {
      actionKey: "action_accumulate_qualifying_work_experience",
      relatedRouteKeys: ["route_sqe_standard"],
      relatedRequirementKeys: ["req_qualifying_work_experience"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: [],
      evidenceKeys: ["ev_sra_qualifying_work_experience"],
    },
    {
      actionKey: "action_seek_sra_equivalence_decision",
      relatedRouteKeys: ["route_sqe_standard", "route_solicitor_apprenticeship_graduate"],
      relatedRequirementKeys: ["req_degree_or_equivalent"],
      relatedBarrierKeys: ["barrier_no_degree_or_equivalent_for_admission"],
      relatedUnresolvedCheckKeys: ["check_degree_equivalence_sra_decision"],
      evidenceKeys: ["ev_sra_degree_equivalent"],
    },
    {
      actionKey: "action_disclose_suitability_to_regulator",
      relatedRouteKeys: [],
      relatedRequirementKeys: ["req_sra_suitability"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_sra_suitability_disclosure"],
      evidenceKeys: ["ev_sra_pathways_to_qualification"],
    },
    {
      actionKey: "action_verify_transitional_eligibility",
      relatedRouteKeys: ["route_lpc_transitional"],
      relatedRequirementKeys: ["req_lpc_transitional_eligibility"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_lpc_transitional_verification"],
      evidenceKeys: ["ev_sra_pathways_to_qualification"],
    },
  ],

  actionRules: [
    {
      ruleKey: "xr_book_sqe1",
      actionKey: "action_book_sqe1",
      when: { question: Q_SQE1, operator: "equals", value: "not_yet_taken" },
    },
    {
      ruleKey: "xr_book_sqe2",
      actionKey: "action_book_sqe2",
      when: { question: Q_SQE2, operator: "equals", value: "not_yet_taken" },
    },
    {
      ruleKey: "xr_accumulate_qwe",
      actionKey: "action_accumulate_qualifying_work_experience",
      when: { question: Q_QWE_MONTHS, operator: "lt", value: 24 },
    },
    {
      ruleKey: "xr_seek_equivalence_decision",
      actionKey: "action_seek_sra_equivalence_decision",
      when: { question: Q_DEGREE, operator: "equals", value: "equivalence_needs_sra_decision" },
    },
    {
      ruleKey: "xr_disclose_suitability",
      actionKey: "action_disclose_suitability_to_regulator",
      when: { question: Q_SUITABILITY, operator: "equals", value: "issue_to_disclose" },
    },
    {
      ruleKey: "xr_verify_transitional_eligibility",
      actionKey: "action_verify_transitional_eligibility",
      when: { question: Q_LPC, operator: "equals", value: "not_sure" },
    },
  ],

  evidence: EVIDENCE,

  /*
   * PRE-PUBLICATION content: ranking reconciliation ACCEPTED by the product
   * owner on 2026-08-27 as part of Increment 16. Acceptance is internal
   * governance only — it does not imply external publication or deployment.

   *
   * Ordered, inspectable factors only — no numeric magnitude of any kind — read
   * from questions this pack already asks and scoped to routes it already
   * declares. The authored ORDER is the governed precedence.
   *
   * The encoded reasoning uses the participant's own answers only: an
   * explicitly sought apprenticeship starting point is not displaced by an
   * unrelated transitional route; where no apprenticeship is sought and
   * transitional eligibility is CONFIRMED, the transitional route is the more
   * specific governed starting point; where no apprenticeship is sought and the
   * participant is explicitly NOT eligible for the transitional arrangements,
   * the standard SQE route is the relevant non-apprenticeship route. An unsure
   * transitional answer creates no LPC or SQE preference at all.
   */
  rankingConfigs: [
    {
      rankingConfigKey: "ranking_solicitor_starting_point",
      factors: [
        {
          factorKey: "factor_non_graduate_apprenticeship_starting_point",
          preferWhen: {
            question: Q_APPRENTICESHIP_START,
            operator: "equals",
            value: "non_graduate",
          },
          routeKeys: ["route_solicitor_apprenticeship_non_graduate"],
        },
        {
          factorKey: "factor_graduate_apprenticeship_starting_point",
          preferWhen: { question: Q_APPRENTICESHIP_START, operator: "equals", value: "graduate" },
          routeKeys: ["route_solicitor_apprenticeship_graduate"],
        },
        {
          factorKey: "factor_confirmed_transitional_without_apprenticeship",
          preferWhen: {
            all: [
              { question: Q_LPC, operator: "equals", value: "confirmed_eligible" },
              {
                question: Q_APPRENTICESHIP_START,
                operator: "equals",
                value: "not_seeking_apprenticeship",
              },
            ],
          },
          routeKeys: ["route_lpc_transitional"],
        },
        {
          factorKey: "factor_standard_sqe_when_no_apprenticeship_sought",
          preferWhen: {
            all: [
              {
                question: Q_APPRENTICESHIP_START,
                operator: "equals",
                value: "not_seeking_apprenticeship",
              },
              /*
               * Only an explicit `not_eligible` transitional answer makes the
               * standard route the relevant non-apprenticeship starting point.
               * `not_sure` is unresolved, and an unresolved answer must never
               * manufacture a preference for either route.
               */
              { question: Q_LPC, operator: "equals", value: "not_eligible" },
            ],
          },
          routeKeys: ["route_sqe_standard"],
        },
      ],
    },
  ],

  localRequirements: [],

  review: {},

  scenarios: [
    {
      /* Degree holder at the start of the SQE route: eligible, with the
       * assessment and experience milestones outstanding as CONDITIONS. */
      scenarioKey: "scenario_degree_holder_sqe_milestones_outstanding",
      answers: [
        { question: Q_DEGREE, value: "confirmed_level6_plus" },
        { question: Q_SQE1, value: "not_yet_taken" },
        { question: Q_SQE2, value: "not_yet_taken" },
        { question: Q_QWE_MONTHS, value: 0 },
        { question: Q_APPRENTICESHIP_START, value: "not_seeking_apprenticeship" },
        { question: Q_SUITABILITY, value: "no_known_issue" },
        { question: Q_LPC, value: "not_eligible" },
        { question: Q_LEGAL_EMPLOYMENT, value: "in_legal_role" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        { kind: "route_eligibility_is", routeKey: "route_sqe_standard", eligibility: true },
        { kind: "requirement_state_is", requirementKey: "req_sqe1_passed", state: "unmet" },
        { kind: "action_present", actionKey: "action_book_sqe1" },
        { kind: "action_present", actionKey: "action_accumulate_qualifying_work_experience" },
      ],
    },
    {
      /* No degree or equivalence: admission through the standard route is blocked,
       * yet the non-graduate apprenticeship route remains genuinely open. */
      scenarioKey: "scenario_non_graduate_apprenticeship_alternative",
      answers: [
        { question: Q_DEGREE, value: "none" },
        { question: Q_SQE1, value: "not_yet_taken" },
        { question: Q_SQE2, value: "not_yet_taken" },
        { question: Q_QWE_MONTHS, value: 0 },
        { question: Q_APPRENTICESHIP_START, value: "non_graduate" },
        { question: Q_SUITABILITY, value: "no_known_issue" },
        { question: Q_LPC, value: "not_eligible" },
        { question: Q_LEGAL_EMPLOYMENT, value: "offer_held" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_solicitor_apprenticeship_non_graduate",
          eligibility: true,
        },
        { kind: "route_eligibility_is", routeKey: "route_sqe_standard", eligibility: false },
        { kind: "barrier_present", barrierKey: "barrier_no_degree_or_equivalent_for_admission" },
        {
          kind: "requirement_state_is",
          requirementKey: "req_degree_or_equivalent",
          state: "unmet",
        },
      ],
    },
    {
      /* Overseas qualification awaiting an SRA equivalence decision: unresolved,
       * never a refusal. */
      scenarioKey: "scenario_degree_equivalence_awaiting_decision",
      answers: [
        { question: Q_DEGREE, value: "equivalence_needs_sra_decision" },
        { question: Q_SQE1, value: "passed" },
        { question: Q_SQE2, value: "not_yet_taken" },
        { question: Q_QWE_MONTHS, value: 12 },
        { question: Q_APPRENTICESHIP_START, value: "not_seeking_apprenticeship" },
        { question: Q_SUITABILITY, value: "no_known_issue" },
        { question: Q_LPC, value: "not_sure" },
        { question: Q_LEGAL_EMPLOYMENT, value: "in_legal_role" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "more_information_needed" },
        {
          kind: "requirement_state_is",
          requirementKey: "req_degree_or_equivalent",
          state: "verification_required",
        },
        { kind: "unresolved_check_present", checkKey: "check_degree_equivalence_sra_decision" },
        { kind: "action_present", actionKey: "action_seek_sra_equivalence_decision" },
        { kind: "route_eligibility_is", routeKey: "route_sqe_standard", eligibility: null },
      ],
    },
    {
      /* Suitability matter to disclose: the regulator's judgement is outstanding
       * across every route, so the outcome is unresolved rather than negative. */
      scenarioKey: "scenario_suitability_matter_to_disclose",
      answers: [
        { question: Q_DEGREE, value: "confirmed_level6_plus" },
        { question: Q_SQE1, value: "passed" },
        { question: Q_SQE2, value: "passed" },
        { question: Q_QWE_MONTHS, value: 24 },
        { question: Q_APPRENTICESHIP_START, value: "not_seeking_apprenticeship" },
        { question: Q_SUITABILITY, value: "issue_to_disclose" },
        { question: Q_LPC, value: "not_eligible" },
        { question: Q_LEGAL_EMPLOYMENT, value: "in_legal_role" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "more_information_needed" },
        {
          kind: "requirement_state_is",
          requirementKey: "req_sra_suitability",
          state: "verification_required",
        },
        { kind: "unresolved_check_present", checkKey: "check_sra_suitability_disclosure" },
        { kind: "action_present", actionKey: "action_disclose_suitability_to_regulator" },
      ],
    },
    {
      /* Confirmed transitional eligibility: a distinct declared route stands on
       * its own terms without the SQE milestones. */
      scenarioKey: "scenario_confirmed_transitional_route",
      answers: [
        { question: Q_DEGREE, value: "confirmed_level6_plus" },
        { question: Q_SQE1, value: "not_yet_taken" },
        { question: Q_SQE2, value: "not_yet_taken" },
        { question: Q_QWE_MONTHS, value: 24 },
        { question: Q_APPRENTICESHIP_START, value: "not_seeking_apprenticeship" },
        { question: Q_SUITABILITY, value: "no_known_issue" },
        { question: Q_LPC, value: "confirmed_eligible" },
        { question: Q_LEGAL_EMPLOYMENT, value: "in_legal_role" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_now" },
        { kind: "route_eligibility_is", routeKey: "route_lpc_transitional", eligibility: true },
        {
          kind: "requirement_state_is",
          requirementKey: "req_lpc_transitional_eligibility",
          state: "met",
        },
      ],
    },
  ],
});
