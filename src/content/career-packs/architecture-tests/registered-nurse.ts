import { parseCanonicalCareerPack, type CareerPack } from "../../../domain/career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../../domain/career-packs/version";
import type { QuestionRef } from "../../../domain/questions";
import { evidenceReference } from "./sources";

/**
 * ARCHITECTURE-TEST Career Pack — Registered Nurse (UK, NMC).
 *
 * Content only. This pack is DATA plus declarative rules evaluated by the shared
 * Decision Engine; it contains no evaluator, no participant-facing copy, no
 * publication state and no local geographic implementation.
 *
 * Modelling notes that matter for the architecture:
 * - `unknown` is never turned into `unmet`. Unchecked provider entry is
 *   `verification_required`, never failure.
 * - Local access to an NMC-approved programme is declared as a LOCAL requirement
 *   with an unresolved check. Absence of a local programme is unresolved, never
 *   route impossibility (Increment 17 owns Local Reality).
 * - Employer-dependent apprenticeship support is `verification_required`, never a
 *   universal negative fact.
 */

const PACK_ID = "9a1e0001-0001-4000-8000-000000000001";

const ARCHETYPE_VERSION = "1.0.0" as const;
const MODULE_FRAMEWORK_VERSION = "1.0.0" as const;

function qref(moduleCode: string, questionKey: string): QuestionRef {
  return { moduleCode, questionKey } as QuestionRef;
}

const Q_REGISTRATION = qref("registration", "nursing_registration_status");
const Q_HEALTH_CHARACTER = qref("background_checks", "health_character_declaration_status");
const Q_APPROVED_PROGRAMME = qref("qualifications", "approved_programme_entry_status");
const Q_APPRENTICESHIP_EMPLOYER = qref("qualifications", "degree_apprenticeship_employer_status");
const Q_STUDY_COMMITMENT = qref("study_availability", "substantial_study_commitment");
const Q_PLACEMENT_COMMITMENT = qref("study_availability", "clinical_placement_pattern_commitment");

const EVIDENCE = [
  {
    evidenceKey: "ev_nmc_becoming_a_nurse",
    reference: evidenceReference("nmc", "nmc_becoming_a_nurse", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_nmc_approved_programmes",
    reference: evidenceReference("nmc", "nmc_approved_programmes", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_nmc_health_and_character",
    reference: evidenceReference("nmc", "nmc_health_and_character", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_nmc_joining_the_register",
    reference: evidenceReference("nmc", "nmc_joining_the_register", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_skills_england_st0781",
    reference: evidenceReference(
      "skills_england",
      "skills_england_st0781",
      "A",
      "confirmed_requirement",
    ),
  },
];

export const REGISTERED_NURSE_PACK: CareerPack = parseCanonicalCareerPack({
  schemaVersion: CAREER_PACK_SCHEMA_VERSION,
  careerPackId: PACK_ID,
  version: "1.0.0",
  occupation: { occupationKey: "registered_nurse" },

  questionModules: [
    {
      moduleCode: "registration",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_REGISTRATION.questionKey,
          moduleCode: "registration",
          input: {
            kind: "single_select",
            optionKeys: [
              "registered_nurse",
              "registered_nursing_associate",
              "overseas_qualified_nurse",
              "not_yet_qualified",
            ],
          },
          consequences: ["eligibility", "route_availability", "next_action"],
        },
      ],
    },
    {
      moduleCode: "background_checks",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_HEALTH_CHARACTER.questionKey,
          moduleCode: "background_checks",
          input: {
            kind: "single_select",
            optionKeys: ["no_known_issue", "issue_to_declare", "regulator_cleared"],
          },
          consequences: ["unresolved_check", "barrier", "next_action"],
        },
      ],
    },
    {
      moduleCode: "qualifications",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_APPROVED_PROGRAMME.questionKey,
          moduleCode: "qualifications",
          input: {
            kind: "single_select",
            optionKeys: ["confirmed", "not_yet_checked", "known_not_met"],
          },
          consequences: ["eligibility", "unresolved_check", "next_action"],
        },
        {
          questionKey: Q_APPRENTICESHIP_EMPLOYER.questionKey,
          moduleCode: "qualifications",
          input: {
            kind: "single_select",
            optionKeys: ["confirmed", "not_confirmed", "not_applicable"],
          },
          consequences: ["eligibility", "route_availability", "unresolved_check", "next_action"],
        },
      ],
    },
    {
      moduleCode: "study_availability",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_STUDY_COMMITMENT.questionKey,
          moduleCode: "study_availability",
          input: { kind: "single_select", optionKeys: ["able", "unable", "unsure"] },
          consequences: ["practical_fit", "unresolved_check"],
        },
        {
          questionKey: Q_PLACEMENT_COMMITMENT.questionKey,
          moduleCode: "study_availability",
          input: { kind: "single_select", optionKeys: ["able", "unable", "unsure"] },
          consequences: ["practical_fit", "unresolved_check"],
        },
      ],
    },
  ],

  routes: [
    {
      routeKey: "route_registered_practice",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "direct_employment", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_nmc_registration_held"],
      practicalFitRequirementKeys: [],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_nmc_approved_degree",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "regulated_undergraduate", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_approved_programme_entry"],
      practicalFitRequirementKeys: ["req_study_commitment", "req_clinical_placement_commitment"],
      availabilityRuleKeys: [],
      localRequirementKeys: ["local_approved_programme_access"],
    },
    {
      routeKey: "route_nurse_degree_apprenticeship",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "degree_apprenticeship", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_apprenticeship_employer_support"],
      practicalFitRequirementKeys: ["req_study_commitment", "req_clinical_placement_commitment"],
      availabilityRuleKeys: ["ar_apprenticeship_not_sought"],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_nursing_associate_bridge",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [
          { code: "bridging", version: ARCHETYPE_VERSION },
          { code: "regulated_undergraduate", version: ARCHETYPE_VERSION },
        ],
      },
      eligibilityRequirementKeys: [
        "req_nursing_associate_background",
        "req_approved_programme_entry",
      ],
      practicalFitRequirementKeys: ["req_study_commitment"],
      availabilityRuleKeys: ["ar_bridge_requires_nursing_associate"],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_overseas_registration",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "regulator_verification", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_overseas_competence_verification"],
      practicalFitRequirementKeys: [],
      availabilityRuleKeys: ["ar_overseas_route_requires_overseas_registration"],
      localRequirementKeys: [],
    },
  ],

  requirements: [
    {
      requirementKey: "req_nmc_registration_held",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_nmc_becoming_a_nurse"],
    },
    {
      requirementKey: "req_approved_programme_entry",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_nmc_approved_programmes"],
    },
    {
      requirementKey: "req_apprenticeship_employer_support",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_skills_england_st0781"],
    },
    {
      requirementKey: "req_nursing_associate_background",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_nmc_becoming_a_nurse"],
    },
    {
      requirementKey: "req_overseas_competence_verification",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_nmc_joining_the_register"],
    },
    {
      requirementKey: "req_study_commitment",
      severity: "mandatory",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_nmc_becoming_a_nurse"],
    },
    {
      requirementKey: "req_clinical_placement_commitment",
      severity: "mandatory",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_nmc_becoming_a_nurse"],
    },
  ],

  requirementRules: [
    {
      ruleKey: "rr_registration_held",
      requirementKey: "req_nmc_registration_held",
      when: { question: Q_REGISTRATION, operator: "equals", value: "registered_nurse" },
      state: "met",
    },
    {
      ruleKey: "rr_registration_not_yet_qualified",
      requirementKey: "req_nmc_registration_held",
      when: { question: Q_REGISTRATION, operator: "equals", value: "not_yet_qualified" },
      state: "unmet",
    },
    {
      ruleKey: "rr_registration_nursing_associate",
      requirementKey: "req_nmc_registration_held",
      when: { question: Q_REGISTRATION, operator: "equals", value: "registered_nursing_associate" },
      state: "unmet",
    },
    {
      ruleKey: "rr_registration_overseas_verification",
      requirementKey: "req_nmc_registration_held",
      when: { question: Q_REGISTRATION, operator: "equals", value: "overseas_qualified_nurse" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_approved_programme_confirmed",
      requirementKey: "req_approved_programme_entry",
      when: { question: Q_APPROVED_PROGRAMME, operator: "equals", value: "confirmed" },
      state: "met",
    },
    {
      ruleKey: "rr_approved_programme_known_not_met",
      requirementKey: "req_approved_programme_entry",
      when: { question: Q_APPROVED_PROGRAMME, operator: "equals", value: "known_not_met" },
      state: "unmet",
    },
    {
      ruleKey: "rr_approved_programme_unchecked",
      requirementKey: "req_approved_programme_entry",
      when: { question: Q_APPROVED_PROGRAMME, operator: "equals", value: "not_yet_checked" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_apprenticeship_employer_confirmed",
      requirementKey: "req_apprenticeship_employer_support",
      when: { question: Q_APPRENTICESHIP_EMPLOYER, operator: "equals", value: "confirmed" },
      state: "met",
    },
    {
      /* Employer-specific: unconfirmed support is verification, never failure. */
      ruleKey: "rr_apprenticeship_employer_unconfirmed",
      requirementKey: "req_apprenticeship_employer_support",
      when: { question: Q_APPRENTICESHIP_EMPLOYER, operator: "equals", value: "not_confirmed" },
      state: "verification_required",
    },
    {
      ruleKey: "rr_apprenticeship_employer_not_applicable",
      requirementKey: "req_apprenticeship_employer_support",
      when: { question: Q_APPRENTICESHIP_EMPLOYER, operator: "equals", value: "not_applicable" },
      state: "not_applicable",
    },

    {
      ruleKey: "rr_nursing_associate_background_held",
      requirementKey: "req_nursing_associate_background",
      when: { question: Q_REGISTRATION, operator: "equals", value: "registered_nursing_associate" },
      state: "met",
    },
    {
      ruleKey: "rr_nursing_associate_background_other",
      requirementKey: "req_nursing_associate_background",
      when: {
        question: Q_REGISTRATION,
        operator: "not_equals",
        value: "registered_nursing_associate",
      },
      state: "not_applicable",
    },

    {
      ruleKey: "rr_overseas_verification_required",
      requirementKey: "req_overseas_competence_verification",
      when: { question: Q_REGISTRATION, operator: "equals", value: "overseas_qualified_nurse" },
      state: "verification_required",
    },
    {
      ruleKey: "rr_overseas_verification_not_applicable",
      requirementKey: "req_overseas_competence_verification",
      when: { question: Q_REGISTRATION, operator: "not_equals", value: "overseas_qualified_nurse" },
      state: "not_applicable",
    },

    {
      ruleKey: "rr_study_commitment_able",
      requirementKey: "req_study_commitment",
      when: { question: Q_STUDY_COMMITMENT, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_study_commitment_unable",
      requirementKey: "req_study_commitment",
      when: { question: Q_STUDY_COMMITMENT, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_study_commitment_unsure",
      requirementKey: "req_study_commitment",
      when: { question: Q_STUDY_COMMITMENT, operator: "equals", value: "unsure" },
      state: "unknown",
    },

    {
      ruleKey: "rr_placement_commitment_able",
      requirementKey: "req_clinical_placement_commitment",
      when: { question: Q_PLACEMENT_COMMITMENT, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_placement_commitment_unable",
      requirementKey: "req_clinical_placement_commitment",
      when: { question: Q_PLACEMENT_COMMITMENT, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_placement_commitment_unsure",
      requirementKey: "req_clinical_placement_commitment",
      when: { question: Q_PLACEMENT_COMMITMENT, operator: "equals", value: "unsure" },
      state: "unknown",
    },
  ],

  routeAvailabilityRules: [
    {
      ruleKey: "ar_apprenticeship_not_sought",
      routeKey: "route_nurse_degree_apprenticeship",
      when: { question: Q_APPRENTICESHIP_EMPLOYER, operator: "equals", value: "not_applicable" },
      available: false,
    },
    {
      ruleKey: "ar_bridge_requires_nursing_associate",
      routeKey: "route_nursing_associate_bridge",
      when: {
        question: Q_REGISTRATION,
        operator: "not_equals",
        value: "registered_nursing_associate",
      },
      available: false,
    },
    {
      ruleKey: "ar_overseas_route_requires_overseas_registration",
      routeKey: "route_overseas_registration",
      when: { question: Q_REGISTRATION, operator: "not_equals", value: "overseas_qualified_nurse" },
      available: false,
    },
  ],

  barriers: [
    {
      barrierKey: "barrier_declared_health_character_issue",
      blocking: false,
      relatedRequirementKeys: [],
      relatedRouteKeys: [],
      evidenceKeys: ["ev_nmc_health_and_character"],
    },
  ],

  barrierRules: [
    {
      ruleKey: "br_declared_health_character_issue",
      barrierKey: "barrier_declared_health_character_issue",
      when: { question: Q_HEALTH_CHARACTER, operator: "equals", value: "issue_to_declare" },
    },
  ],

  unresolvedChecks: [
    {
      checkKey: "check_health_character_review",
      relatedRequirementKeys: [],
      relatedRouteKeys: [],
      explanationKey: "explain.regulator_reviews_health_and_character",
    },
    {
      checkKey: "check_approved_programme_entry_verification",
      relatedRequirementKeys: ["req_approved_programme_entry"],
      relatedRouteKeys: ["route_nmc_approved_degree", "route_nursing_associate_bridge"],
      explanationKey: "explain.provider_confirms_programme_entry",
    },
    {
      checkKey: "check_apprenticeship_employer_confirmation",
      relatedRequirementKeys: ["req_apprenticeship_employer_support"],
      relatedRouteKeys: ["route_nurse_degree_apprenticeship"],
      explanationKey: "explain.employer_confirms_apprenticeship_support",
    },
    {
      checkKey: "check_overseas_registration_verification",
      relatedRequirementKeys: ["req_overseas_competence_verification"],
      relatedRouteKeys: ["route_overseas_registration"],
      explanationKey: "explain.regulator_verifies_overseas_competence",
    },
    {
      checkKey: "check_local_approved_programme_access",
      relatedRequirementKeys: [],
      relatedRouteKeys: ["route_nmc_approved_degree"],
      explanationKey: "explain.local_approved_programme_access_unresolved",
    },
    {
      checkKey: "check_study_and_placement_commitment_review",
      relatedRequirementKeys: ["req_study_commitment", "req_clinical_placement_commitment"],
      relatedRouteKeys: [
        "route_nmc_approved_degree",
        "route_nurse_degree_apprenticeship",
        "route_nursing_associate_bridge",
      ],
      explanationKey: "explain.study_and_placement_commitment_unresolved",
    },
  ],

  unresolvedCheckRules: [
    {
      ruleKey: "cr_health_character_review",
      checkKey: "check_health_character_review",
      when: { question: Q_HEALTH_CHARACTER, operator: "equals", value: "issue_to_declare" },
    },
    {
      ruleKey: "cr_approved_programme_entry_verification",
      checkKey: "check_approved_programme_entry_verification",
      when: { question: Q_APPROVED_PROGRAMME, operator: "equals", value: "not_yet_checked" },
    },
    {
      ruleKey: "cr_apprenticeship_employer_confirmation",
      checkKey: "check_apprenticeship_employer_confirmation",
      when: { question: Q_APPRENTICESHIP_EMPLOYER, operator: "equals", value: "not_confirmed" },
    },
    {
      ruleKey: "cr_overseas_registration_verification",
      checkKey: "check_overseas_registration_verification",
      when: { question: Q_REGISTRATION, operator: "equals", value: "overseas_qualified_nurse" },
    },
  ],

  actions: [
    {
      actionKey: "action_verify_approved_programme_entry",
      relatedRouteKeys: ["route_nmc_approved_degree", "route_nursing_associate_bridge"],
      relatedRequirementKeys: ["req_approved_programme_entry"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_approved_programme_entry_verification"],
      evidenceKeys: ["ev_nmc_approved_programmes"],
    },
    {
      actionKey: "action_declare_health_character_to_regulator",
      relatedRouteKeys: [],
      relatedRequirementKeys: [],
      relatedBarrierKeys: ["barrier_declared_health_character_issue"],
      relatedUnresolvedCheckKeys: ["check_health_character_review"],
      evidenceKeys: ["ev_nmc_health_and_character"],
    },
    {
      actionKey: "action_begin_overseas_registration_verification",
      relatedRouteKeys: ["route_overseas_registration"],
      relatedRequirementKeys: ["req_overseas_competence_verification"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_overseas_registration_verification"],
      evidenceKeys: ["ev_nmc_joining_the_register"],
    },
    {
      actionKey: "action_confirm_apprenticeship_employer_support",
      relatedRouteKeys: ["route_nurse_degree_apprenticeship"],
      relatedRequirementKeys: ["req_apprenticeship_employer_support"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_apprenticeship_employer_confirmation"],
      evidenceKeys: ["ev_skills_england_st0781"],
    },
  ],

  actionRules: [
    {
      ruleKey: "xr_verify_approved_programme_entry",
      actionKey: "action_verify_approved_programme_entry",
      when: { question: Q_APPROVED_PROGRAMME, operator: "equals", value: "not_yet_checked" },
    },
    {
      ruleKey: "xr_declare_health_character",
      actionKey: "action_declare_health_character_to_regulator",
      when: { question: Q_HEALTH_CHARACTER, operator: "equals", value: "issue_to_declare" },
    },
    {
      ruleKey: "xr_begin_overseas_verification",
      actionKey: "action_begin_overseas_registration_verification",
      when: { question: Q_REGISTRATION, operator: "equals", value: "overseas_qualified_nurse" },
    },
    {
      ruleKey: "xr_confirm_apprenticeship_employer_support",
      actionKey: "action_confirm_apprenticeship_employer_support",
      when: { question: Q_APPRENTICESHIP_EMPLOYER, operator: "equals", value: "not_confirmed" },
    },
  ],

  evidence: EVIDENCE,

  /*
   * PRE-PUBLICATION content: ranking reconciliation ACCEPTED by the product
   * owner on 2026-08-27 as part of Increment 16. Acceptance is internal
   * governance only — it does not imply external publication or deployment.

   *
   * Ordered, inspectable factors only: no numeric magnitude, probability or
   * magnitude exists here, and the ORDER below IS the governed precedence under
   * the closed lexicographic ranking engine. Every factor reads a question this
   * pack already asks and scopes to a route this pack already declares.
   *
   * Deliberately narrow: only a participant's DIRECT current starting status —
   * already registered, registered nursing associate, or overseas qualified —
   * establishes a preference, because each of those facts belongs to exactly one
   * declared route. There is deliberately NO factor comparing the apprenticeship
   * route with the approved-degree route: confirmed employer support and
   * confirmed programme entry are both legitimate starting points for a
   * prospective entrant, and nothing in the reviewed sources makes either the
   * preferable one. A prospective entrant who confirms both therefore receives
   * no authored preference at all.
   */

  rankingConfigs: [
    {
      rankingConfigKey: "ranking_registered_nurse_starting_point",
      factors: [
        {
          factorKey: "factor_registration_already_held",
          preferWhen: { question: Q_REGISTRATION, operator: "equals", value: "registered_nurse" },
          routeKeys: ["route_registered_practice"],
        },
        {
          factorKey: "factor_nursing_associate_starting_point",
          preferWhen: {
            question: Q_REGISTRATION,
            operator: "equals",
            value: "registered_nursing_associate",
          },
          routeKeys: ["route_nursing_associate_bridge"],
        },
        {
          factorKey: "factor_overseas_qualified_starting_point",
          preferWhen: {
            question: Q_REGISTRATION,
            operator: "equals",
            value: "overseas_qualified_nurse",
          },
          routeKeys: ["route_overseas_registration"],
        },
      ],
    },
  ],

  localRequirements: [
    {
      localRequirementKey: "local_approved_programme_access",
      localFactKey: "local_fact.nmc_approved_programme_access",
      relatedRouteKeys: ["route_nmc_approved_degree"],
      purposes: ["route_availability"],
      unresolvedCheckKey: "check_local_approved_programme_access",
    },
  ],

  review: {},

  scenarios: [
    {
      /* Already registered: the direct practice route is genuinely open now. */
      scenarioKey: "scenario_registered_nurse_direct_practice",
      answers: [
        { question: Q_REGISTRATION, value: "registered_nurse" },
        { question: Q_HEALTH_CHARACTER, value: "no_known_issue" },
        { question: Q_APPROVED_PROGRAMME, value: "not_yet_checked" },
        { question: Q_APPRENTICESHIP_EMPLOYER, value: "not_applicable" },
        { question: Q_STUDY_COMMITMENT, value: "able" },
        { question: Q_PLACEMENT_COMMITMENT, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_now" },
        { kind: "route_eligibility_is", routeKey: "route_registered_practice", eligibility: true },
        { kind: "requirement_state_is", requirementKey: "req_nmc_registration_held", state: "met" },
      ],
    },
    {
      /* Prospective entrant with confirmed provider entry: the degree route is
       * eligible and a practical fit, and remains unresolved only because local
       * programme access is not yet known — never because it is impossible. */
      scenarioKey: "scenario_prospective_approved_degree_candidate",
      answers: [
        { question: Q_REGISTRATION, value: "not_yet_qualified" },
        { question: Q_HEALTH_CHARACTER, value: "no_known_issue" },
        { question: Q_APPROVED_PROGRAMME, value: "confirmed" },
        { question: Q_APPRENTICESHIP_EMPLOYER, value: "not_applicable" },
        { question: Q_STUDY_COMMITMENT, value: "able" },
        { question: Q_PLACEMENT_COMMITMENT, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "more_information_needed" },
        { kind: "route_eligibility_is", routeKey: "route_nmc_approved_degree", eligibility: true },
        {
          kind: "route_practical_fit_is",
          routeKey: "route_nmc_approved_degree",
          practicalFit: true,
        },
        { kind: "route_eligibility_is", routeKey: "route_registered_practice", eligibility: false },
        { kind: "unresolved_check_present", checkKey: "check_local_approved_programme_access" },
      ],
    },
    {
      /* Registered nursing associate: the bridging route is open now. */
      scenarioKey: "scenario_nursing_associate_bridging",
      answers: [
        { question: Q_REGISTRATION, value: "registered_nursing_associate" },
        { question: Q_HEALTH_CHARACTER, value: "no_known_issue" },
        { question: Q_APPROVED_PROGRAMME, value: "confirmed" },
        { question: Q_APPRENTICESHIP_EMPLOYER, value: "not_applicable" },
        { question: Q_STUDY_COMMITMENT, value: "able" },
        { question: Q_PLACEMENT_COMMITMENT, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_now" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_nursing_associate_bridge",
          eligibility: true,
        },
        {
          kind: "requirement_state_is",
          requirementKey: "req_nursing_associate_background",
          state: "met",
        },
      ],
    },
    {
      /* Declared health/character matter: regulator judgement is outstanding, so
       * the outcome is unresolved. Registration itself stays `met`. */
      scenarioKey: "scenario_health_character_issue_to_declare",
      answers: [
        { question: Q_REGISTRATION, value: "registered_nurse" },
        { question: Q_HEALTH_CHARACTER, value: "issue_to_declare" },
        { question: Q_APPROVED_PROGRAMME, value: "not_yet_checked" },
        { question: Q_APPRENTICESHIP_EMPLOYER, value: "not_applicable" },
        { question: Q_STUDY_COMMITMENT, value: "able" },
        { question: Q_PLACEMENT_COMMITMENT, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "more_information_needed" },
        { kind: "unresolved_check_present", checkKey: "check_health_character_review" },
        { kind: "barrier_present", barrierKey: "barrier_declared_health_character_issue" },
        { kind: "action_present", actionKey: "action_declare_health_character_to_regulator" },
        { kind: "requirement_state_is", requirementKey: "req_nmc_registration_held", state: "met" },
      ],
    },
    {
      /* Overseas-qualified: regulator verification is required, never refusal. */
      scenarioKey: "scenario_overseas_qualified_regulator_verification",
      answers: [
        { question: Q_REGISTRATION, value: "overseas_qualified_nurse" },
        { question: Q_HEALTH_CHARACTER, value: "no_known_issue" },
        { question: Q_APPROVED_PROGRAMME, value: "not_yet_checked" },
        { question: Q_APPRENTICESHIP_EMPLOYER, value: "not_applicable" },
        { question: Q_STUDY_COMMITMENT, value: "able" },
        { question: Q_PLACEMENT_COMMITMENT, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "more_information_needed" },
        {
          kind: "requirement_state_is",
          requirementKey: "req_overseas_competence_verification",
          state: "verification_required",
        },
        { kind: "unresolved_check_present", checkKey: "check_overseas_registration_verification" },
        { kind: "action_present", actionKey: "action_begin_overseas_registration_verification" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_overseas_registration",
          eligibility: null,
        },
      ],
    },
  ],
});
