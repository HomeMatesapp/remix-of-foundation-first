import { parseCanonicalCareerPack, type CareerPack } from "../../../domain/career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../../domain/career-packs/version";
import type { QuestionRef } from "../../../domain/questions";
import { evidenceReference } from "./sources";

/**
 * ARCHITECTURE-TEST Career Pack — Electrician (UK, nation-sensitive).
 *
 * Modelling notes that matter for the architecture:
 * - The Experienced Worker Assessment routes are declared UNAVAILABLE where the
 *   authoritative English/Welsh/Northern Irish scheme evidence does not extend,
 *   rather than silently applying English criteria to Scotland.
 * - Employer entry criteria are provider-dependent: they are declared as a
 *   PREFERRED requirement resolving to `verification_required`, never as a
 *   universal eligibility failure.
 * - Route/portfolio guidance graded B / `general_guidance` can never create
 *   certainty; the shared engine's evidence ceiling holds it at
 *   `verification_required`.
 */

const PACK_ID = "9a1e0002-0002-4000-8000-000000000002";

const ARCHETYPE_VERSION = "1.0.0" as const;
const MODULE_FRAMEWORK_VERSION = "1.0.0" as const;

function qref(moduleCode: string, questionKey: string): QuestionRef {
  return { moduleCode, questionKey } as QuestionRef;
}

const Q_NATION = qref("travel_relocation", "uk_nation");
const Q_YEARS = qref("experience", "practising_years_excluding_training");
const Q_SCOPE = qref("experience", "current_work_scope");
const Q_EVIDENCE_CAPACITY = qref("experience", "workplace_evidence_capacity");
const Q_LEVEL2_THEORY = qref("qualifications", "level2_electrical_theory_status");
const Q_QUALIFIED_COMPETENCE = qref("qualifications", "recognised_qualified_competence_status");
const Q_TRAINING_COMMITMENT = qref("study_availability", "training_commitment");
const Q_SITE_TOLERANCE = qref("physical_work_pattern", "height_confined_space_tolerance");

const EVIDENCE = [
  {
    evidenceKey: "ev_ncs_electrician",
    reference: evidenceReference(
      "national_careers_service",
      "ncs_electrician",
      "B",
      "general_guidance",
    ),
  },
  {
    evidenceKey: "ev_ncs_electrician_entry_guidance",
    reference: evidenceReference(
      "national_careers_service",
      "ncs_electrician_entry_requirements",
      "B",
      "provider_dependent",
    ),
  },
  {
    /* Installation and maintenance electrician standard ONLY (ST0152). */
    evidenceKey: "ev_skills_england_st0152",
    reference: evidenceReference(
      "skills_england",
      "skills_england_st0152",
      "A",
      "confirmed_requirement",
    ),
  },
  {
    /* Domestic electrician standard ONLY (ST1017). Never interchangeable with ST0152. */
    evidenceKey: "ev_skills_england_st1017",
    reference: evidenceReference(
      "skills_england",
      "skills_england_st1017",
      "A",
      "confirmed_requirement",
    ),
  },
  {
    evidenceKey: "ev_tesp_ewa_eligibility",
    reference: evidenceReference("tesp_ewa", "tesp_ewa_eligibility", "A", "confirmed_requirement"),
  },
  {
    evidenceKey: "ev_tesp_ewa_installation",
    reference: evidenceReference(
      "tesp_ewa",
      "tesp_ewa_installation_electrician",
      "A",
      "confirmed_requirement",
    ),
  },
  {
    evidenceKey: "ev_tesp_ewa_domestic",
    reference: evidenceReference(
      "tesp_ewa",
      "tesp_ewa_domestic_electrician",
      "A",
      "confirmed_requirement",
    ),
  },
  {
    evidenceKey: "ev_jib_ecs_gold_card",
    reference: evidenceReference("jib_ecs", "jib_ecs_gold_card", "A", "confirmed_requirement"),
  },
];

export const ELECTRICIAN_PACK: CareerPack = parseCanonicalCareerPack({
  schemaVersion: CAREER_PACK_SCHEMA_VERSION,
  careerPackId: PACK_ID,
  version: "1.0.0",
  occupation: { occupationKey: "electrician" },

  questionModules: [
    {
      moduleCode: "travel_relocation",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_NATION.questionKey,
          moduleCode: "travel_relocation",
          input: {
            kind: "single_select",
            optionKeys: ["england", "wales", "northern_ireland", "scotland"],
          },
          consequences: ["route_availability", "eligibility", "next_action"],
        },
      ],
    },
    {
      moduleCode: "experience",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_YEARS.questionKey,
          moduleCode: "experience",
          input: { kind: "integer", min: 0, max: 60, unitKey: "years" },
          consequences: ["eligibility", "route_ranking", "barrier", "next_action"],
        },
        {
          questionKey: Q_SCOPE.questionKey,
          moduleCode: "experience",
          input: {
            kind: "single_select",
            optionKeys: ["installation_maintenance", "domestic", "both", "not_practising"],
          },
          consequences: ["eligibility", "route_ranking", "next_action"],
        },
        {
          questionKey: Q_EVIDENCE_CAPACITY.questionKey,
          moduleCode: "experience",
          input: { kind: "single_select", optionKeys: ["able", "unable", "unsure"] },
          consequences: ["eligibility", "unresolved_check", "route_ranking"],
        },
      ],
    },
    {
      moduleCode: "qualifications",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_LEVEL2_THEORY.questionKey,
          moduleCode: "qualifications",
          input: { kind: "single_select", optionKeys: ["held", "not_held", "unsure"] },
          consequences: ["eligibility", "unresolved_check", "route_ranking", "next_action"],
        },
        {
          questionKey: Q_QUALIFIED_COMPETENCE.questionKey,
          moduleCode: "qualifications",
          input: { kind: "single_select", optionKeys: ["held", "not_held", "unsure"] },
          consequences: ["eligibility", "route_ranking", "unresolved_check", "next_action"],
        },
      ],
    },
    {
      moduleCode: "study_availability",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_TRAINING_COMMITMENT.questionKey,
          moduleCode: "study_availability",
          input: { kind: "single_select", optionKeys: ["able", "unable", "unsure"] },
          consequences: ["practical_fit"],
        },
      ],
    },
    {
      moduleCode: "physical_work_pattern",
      frameworkVersion: MODULE_FRAMEWORK_VERSION,
      questions: [
        {
          questionKey: Q_SITE_TOLERANCE.questionKey,
          moduleCode: "physical_work_pattern",
          input: { kind: "single_select", optionKeys: ["able", "unable", "unsure"] },
          consequences: ["practical_fit", "barrier"],
        },
      ],
    },
  ],

  routes: [
    {
      routeKey: "route_qualified_electrician_direct",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "direct_employment", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_recognised_qualified_competence"],
      practicalFitRequirementKeys: ["req_physical_site_tolerance"],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_installation_maintenance_apprenticeship",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "apprenticeship", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_employer_entry_criteria"],
      practicalFitRequirementKeys: ["req_training_commitment", "req_physical_site_tolerance"],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_domestic_apprenticeship",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "apprenticeship", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: ["req_employer_entry_criteria"],
      practicalFitRequirementKeys: [
        "req_domestic_training_commitment",
        "req_physical_site_tolerance",
      ],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_installation_maintenance_ewa",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "experience_led_progression", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [
        "req_ewa_installation_practising_years",
        "req_ewa_level2_theory",
        "req_ewa_current_practice_installation",
        "req_ewa_workplace_evidence_capacity",
      ],
      practicalFitRequirementKeys: ["req_physical_site_tolerance"],
      availabilityRuleKeys: ["ar_installation_ewa_scheme_scope"],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_domestic_ewa",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "experience_led_progression", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [
        "req_ewa_domestic_practising_years",
        "req_ewa_level2_theory",
        "req_ewa_current_practice_domestic",
        "req_ewa_workplace_evidence_capacity",
      ],
      practicalFitRequirementKeys: ["req_physical_site_tolerance"],
      availabilityRuleKeys: ["ar_domestic_ewa_scheme_scope"],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_college_workplace_bridge",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [
          { code: "vocational_qualification", version: ARCHETYPE_VERSION },
          { code: "bridging", version: ARCHETYPE_VERSION },
        ],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: ["req_training_commitment", "req_physical_site_tolerance"],
      availabilityRuleKeys: [],
      localRequirementKeys: [],
    },
    {
      routeKey: "route_scotland_electrotechnical_verification",
      archetypeComposition: {
        frameworkVersion: ARCHETYPE_VERSION,
        archetypes: [{ code: "regulator_verification", version: ARCHETYPE_VERSION }],
      },
      eligibilityRequirementKeys: [],
      practicalFitRequirementKeys: [],
      availabilityRuleKeys: ["ar_scotland_route_scope"],
      localRequirementKeys: [],
    },
  ],

  requirements: [
    {
      requirementKey: "req_recognised_qualified_competence",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_jib_ecs_gold_card", "ev_ncs_electrician"],
    },
    {
      requirementKey: "req_ewa_installation_practising_years",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_tesp_ewa_installation"],
    },
    {
      requirementKey: "req_ewa_domestic_practising_years",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_tesp_ewa_domestic"],
    },
    {
      requirementKey: "req_ewa_level2_theory",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_tesp_ewa_eligibility"],
    },
    {
      requirementKey: "req_ewa_current_practice_installation",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_tesp_ewa_installation"],
    },
    {
      requirementKey: "req_ewa_current_practice_domestic",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_tesp_ewa_domestic"],
    },
    {
      requirementKey: "req_ewa_workplace_evidence_capacity",
      severity: "mandatory",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_tesp_ewa_eligibility"],
    },
    {
      /* Provider/employer dependent, therefore PREFERRED and never blocking. */
      requirementKey: "req_employer_entry_criteria",
      severity: "preferred",
      purposes: ["eligibility"],
      evidenceKeys: ["ev_ncs_electrician_entry_guidance"],
    },
    {
      /* Installation and maintenance apprenticeship + college bridge (ST0152). */
      requirementKey: "req_training_commitment",
      severity: "mandatory",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_skills_england_st0152"],
    },
    {
      /* Domestic apprenticeship standard is a different standard (ST1017). */
      requirementKey: "req_domestic_training_commitment",
      severity: "mandatory",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_skills_england_st1017"],
    },
    {
      requirementKey: "req_physical_site_tolerance",
      severity: "preferred",
      purposes: ["practical_fit"],
      evidenceKeys: ["ev_ncs_electrician"],
    },
  ],

  requirementRules: [
    {
      ruleKey: "rr_competence_held",
      requirementKey: "req_recognised_qualified_competence",
      when: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "held" },
      state: "met",
    },
    {
      ruleKey: "rr_competence_not_held",
      requirementKey: "req_recognised_qualified_competence",
      when: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "not_held" },
      state: "unmet",
    },
    {
      ruleKey: "rr_competence_unsure",
      requirementKey: "req_recognised_qualified_competence",
      when: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "unsure" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_ewa_installation_years_met",
      requirementKey: "req_ewa_installation_practising_years",
      when: { question: Q_YEARS, operator: "gte", value: 5 },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_installation_years_unmet",
      requirementKey: "req_ewa_installation_practising_years",
      when: { question: Q_YEARS, operator: "lt", value: 5 },
      state: "unmet",
    },
    {
      ruleKey: "rr_ewa_domestic_years_met",
      requirementKey: "req_ewa_domestic_practising_years",
      when: { question: Q_YEARS, operator: "gte", value: 3 },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_domestic_years_unmet",
      requirementKey: "req_ewa_domestic_practising_years",
      when: { question: Q_YEARS, operator: "lt", value: 3 },
      state: "unmet",
    },

    {
      ruleKey: "rr_ewa_level2_held",
      requirementKey: "req_ewa_level2_theory",
      when: { question: Q_LEVEL2_THEORY, operator: "equals", value: "held" },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_level2_not_held",
      requirementKey: "req_ewa_level2_theory",
      when: { question: Q_LEVEL2_THEORY, operator: "equals", value: "not_held" },
      state: "unmet",
    },
    {
      ruleKey: "rr_ewa_level2_unsure",
      requirementKey: "req_ewa_level2_theory",
      when: { question: Q_LEVEL2_THEORY, operator: "equals", value: "unsure" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_ewa_practice_installation",
      requirementKey: "req_ewa_current_practice_installation",
      when: { question: Q_SCOPE, operator: "equals", value: "installation_maintenance" },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_practice_installation_both",
      requirementKey: "req_ewa_current_practice_installation",
      when: { question: Q_SCOPE, operator: "equals", value: "both" },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_practice_installation_domestic_only",
      requirementKey: "req_ewa_current_practice_installation",
      when: { question: Q_SCOPE, operator: "equals", value: "domestic" },
      state: "unmet",
    },
    {
      ruleKey: "rr_ewa_practice_installation_not_practising",
      requirementKey: "req_ewa_current_practice_installation",
      when: { question: Q_SCOPE, operator: "equals", value: "not_practising" },
      state: "unmet",
    },

    {
      ruleKey: "rr_ewa_practice_domestic",
      requirementKey: "req_ewa_current_practice_domestic",
      when: { question: Q_SCOPE, operator: "equals", value: "domestic" },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_practice_domestic_both",
      requirementKey: "req_ewa_current_practice_domestic",
      when: { question: Q_SCOPE, operator: "equals", value: "both" },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_practice_domestic_installation_only",
      requirementKey: "req_ewa_current_practice_domestic",
      when: { question: Q_SCOPE, operator: "equals", value: "installation_maintenance" },
      state: "unmet",
    },
    {
      ruleKey: "rr_ewa_practice_domestic_not_practising",
      requirementKey: "req_ewa_current_practice_domestic",
      when: { question: Q_SCOPE, operator: "equals", value: "not_practising" },
      state: "unmet",
    },

    {
      ruleKey: "rr_ewa_evidence_capacity_able",
      requirementKey: "req_ewa_workplace_evidence_capacity",
      when: { question: Q_EVIDENCE_CAPACITY, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_ewa_evidence_capacity_unable",
      requirementKey: "req_ewa_workplace_evidence_capacity",
      when: { question: Q_EVIDENCE_CAPACITY, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_ewa_evidence_capacity_unsure",
      requirementKey: "req_ewa_workplace_evidence_capacity",
      when: { question: Q_EVIDENCE_CAPACITY, operator: "equals", value: "unsure" },
      state: "verification_required",
    },

    {
      /* Employer criteria are never universal: always verified with the employer. */
      ruleKey: "rr_employer_entry_criteria_verification",
      requirementKey: "req_employer_entry_criteria",
      when: { question: Q_NATION, operator: "answered" },
      state: "verification_required",
    },

    {
      ruleKey: "rr_training_commitment_able",
      requirementKey: "req_training_commitment",
      when: { question: Q_TRAINING_COMMITMENT, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_training_commitment_unable",
      requirementKey: "req_training_commitment",
      when: { question: Q_TRAINING_COMMITMENT, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_training_commitment_unsure",
      requirementKey: "req_training_commitment",
      when: { question: Q_TRAINING_COMMITMENT, operator: "equals", value: "unsure" },
      state: "unknown",
    },

    {
      ruleKey: "rr_domestic_training_commitment_able",
      requirementKey: "req_domestic_training_commitment",
      when: { question: Q_TRAINING_COMMITMENT, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_domestic_training_commitment_unable",
      requirementKey: "req_domestic_training_commitment",
      when: { question: Q_TRAINING_COMMITMENT, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_domestic_training_commitment_unsure",
      requirementKey: "req_domestic_training_commitment",
      when: { question: Q_TRAINING_COMMITMENT, operator: "equals", value: "unsure" },
      state: "unknown",
    },

    {
      ruleKey: "rr_site_tolerance_able",
      requirementKey: "req_physical_site_tolerance",
      when: { question: Q_SITE_TOLERANCE, operator: "equals", value: "able" },
      state: "met",
    },
    {
      ruleKey: "rr_site_tolerance_unable",
      requirementKey: "req_physical_site_tolerance",
      when: { question: Q_SITE_TOLERANCE, operator: "equals", value: "unable" },
      state: "unmet",
    },
    {
      ruleKey: "rr_site_tolerance_unsure",
      requirementKey: "req_physical_site_tolerance",
      when: { question: Q_SITE_TOLERANCE, operator: "equals", value: "unsure" },
      state: "unknown",
    },
  ],

  routeAvailabilityRules: [
    {
      /* The cited scheme evidence covers England, Wales and Northern Ireland. */
      ruleKey: "ar_installation_ewa_scheme_scope",
      routeKey: "route_installation_maintenance_ewa",
      when: { question: Q_NATION, operator: "equals", value: "scotland" },
      available: false,
    },
    {
      ruleKey: "ar_domestic_ewa_scheme_scope",
      routeKey: "route_domestic_ewa",
      when: { question: Q_NATION, operator: "equals", value: "scotland" },
      available: false,
    },
    {
      ruleKey: "ar_scotland_route_scope",
      routeKey: "route_scotland_electrotechnical_verification",
      when: { question: Q_NATION, operator: "not_equals", value: "scotland" },
      available: false,
    },
  ],

  barriers: [
    {
      barrierKey: "barrier_college_study_alone_not_full_competence",
      blocking: false,
      relatedRequirementKeys: ["req_recognised_qualified_competence"],
      relatedRouteKeys: ["route_college_workplace_bridge"],
      evidenceKeys: ["ev_ncs_electrician"],
    },
    {
      barrierKey: "barrier_installation_ewa_practising_years_short",
      blocking: true,
      relatedRequirementKeys: ["req_ewa_installation_practising_years"],
      relatedRouteKeys: ["route_installation_maintenance_ewa"],
      evidenceKeys: ["ev_tesp_ewa_installation"],
    },
  ],

  barrierRules: [
    {
      ruleKey: "br_college_study_alone",
      barrierKey: "barrier_college_study_alone_not_full_competence",
      when: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "not_held" },
    },
    {
      ruleKey: "br_installation_ewa_years_short",
      barrierKey: "barrier_installation_ewa_practising_years_short",
      when: { question: Q_YEARS, operator: "lt", value: 5 },
    },
  ],

  unresolvedChecks: [
    {
      checkKey: "check_ewa_provider_eligibility_verification",
      relatedRequirementKeys: ["req_ewa_level2_theory", "req_ewa_workplace_evidence_capacity"],
      relatedRouteKeys: ["route_installation_maintenance_ewa", "route_domestic_ewa"],
      explanationKey: "explain.assessment_centre_confirms_ewa_eligibility",
    },
    {
      checkKey: "check_recognised_competence_verification",
      relatedRequirementKeys: ["req_recognised_qualified_competence"],
      relatedRouteKeys: ["route_qualified_electrician_direct"],
      explanationKey: "explain.certification_scheme_confirms_competence",
    },
    {
      checkKey: "check_scotland_route_verification",
      relatedRequirementKeys: [],
      relatedRouteKeys: ["route_scotland_electrotechnical_verification"],
      explanationKey: "explain.scottish_route_requires_separate_confirmation",
    },
  ],

  unresolvedCheckRules: [
    {
      ruleKey: "cr_ewa_provider_eligibility",
      checkKey: "check_ewa_provider_eligibility_verification",
      when: {
        any: [
          { question: Q_LEVEL2_THEORY, operator: "equals", value: "unsure" },
          { question: Q_EVIDENCE_CAPACITY, operator: "equals", value: "unsure" },
        ],
      },
    },
    {
      ruleKey: "cr_recognised_competence_verification",
      checkKey: "check_recognised_competence_verification",
      when: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "unsure" },
    },
    {
      ruleKey: "cr_scotland_route_verification",
      checkKey: "check_scotland_route_verification",
      when: { question: Q_NATION, operator: "equals", value: "scotland" },
    },
  ],

  actions: [
    {
      actionKey: "action_confirm_ewa_eligibility_with_assessment_centre",
      relatedRouteKeys: ["route_installation_maintenance_ewa", "route_domestic_ewa"],
      relatedRequirementKeys: ["req_ewa_workplace_evidence_capacity"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_ewa_provider_eligibility_verification"],
      evidenceKeys: ["ev_tesp_ewa_eligibility"],
    },
    {
      actionKey: "action_apply_for_electrical_apprenticeship",
      relatedRouteKeys: [
        "route_installation_maintenance_apprenticeship",
        "route_domestic_apprenticeship",
        "route_college_workplace_bridge",
      ],
      relatedRequirementKeys: ["req_employer_entry_criteria"],
      relatedBarrierKeys: ["barrier_college_study_alone_not_full_competence"],
      relatedUnresolvedCheckKeys: [],
      /* Covers BOTH apprenticeship standards, so BOTH records are cited. */
      evidenceKeys: ["ev_skills_england_st0152", "ev_skills_england_st1017"],
    },
    {
      actionKey: "action_obtain_level2_electrical_theory",
      relatedRouteKeys: ["route_installation_maintenance_ewa", "route_domestic_ewa"],
      relatedRequirementKeys: ["req_ewa_level2_theory"],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: [],
      evidenceKeys: ["ev_tesp_ewa_eligibility"],
    },
    {
      actionKey: "action_check_scottish_electrotechnical_route",
      relatedRouteKeys: ["route_scotland_electrotechnical_verification"],
      relatedRequirementKeys: [],
      relatedBarrierKeys: [],
      relatedUnresolvedCheckKeys: ["check_scotland_route_verification"],
      evidenceKeys: ["ev_ncs_electrician"],
    },
  ],

  actionRules: [
    {
      ruleKey: "xr_confirm_ewa_eligibility",
      actionKey: "action_confirm_ewa_eligibility_with_assessment_centre",
      when: {
        all: [
          { question: Q_SCOPE, operator: "not_equals", value: "not_practising" },
          { question: Q_YEARS, operator: "gte", value: 3 },
        ],
      },
    },
    {
      ruleKey: "xr_apply_for_apprenticeship",
      actionKey: "action_apply_for_electrical_apprenticeship",
      when: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "not_held" },
    },
    {
      ruleKey: "xr_obtain_level2_theory",
      actionKey: "action_obtain_level2_electrical_theory",
      when: { question: Q_LEVEL2_THEORY, operator: "equals", value: "not_held" },
    },
    {
      ruleKey: "xr_check_scottish_route",
      actionKey: "action_check_scottish_electrotechnical_route",
      when: { question: Q_NATION, operator: "equals", value: "scotland" },
    },
  ],

  evidence: EVIDENCE,

  /* Ordered factors only. No weights, no scores, no arithmetic. */
  rankingConfigs: [
    {
      rankingConfigKey: "ranking_electrician_starting_point",
      factors: [
        {
          factorKey: "factor_recognised_competence_already_held",
          preferWhen: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "held" },
          routeKeys: ["route_qualified_electrician_direct"],
        },
        {
          factorKey: "factor_installation_ewa_criteria_evidenced",
          preferWhen: {
            all: [
              { question: Q_YEARS, operator: "gte", value: 5 },
              { question: Q_LEVEL2_THEORY, operator: "equals", value: "held" },
              { question: Q_EVIDENCE_CAPACITY, operator: "equals", value: "able" },
              {
                any: [
                  { question: Q_SCOPE, operator: "equals", value: "installation_maintenance" },
                  { question: Q_SCOPE, operator: "equals", value: "both" },
                ],
              },
            ],
          },
          routeKeys: ["route_installation_maintenance_ewa"],
        },
        {
          factorKey: "factor_domestic_ewa_criteria_evidenced",
          preferWhen: {
            all: [
              { question: Q_YEARS, operator: "gte", value: 3 },
              { question: Q_LEVEL2_THEORY, operator: "equals", value: "held" },
              { question: Q_EVIDENCE_CAPACITY, operator: "equals", value: "able" },
              {
                any: [
                  { question: Q_SCOPE, operator: "equals", value: "domestic" },
                  { question: Q_SCOPE, operator: "equals", value: "both" },
                ],
              },
            ],
          },
          routeKeys: ["route_domestic_ewa"],
        },
        {
          factorKey: "factor_new_entrant_training_route",
          preferWhen: { question: Q_QUALIFIED_COMPETENCE, operator: "equals", value: "not_held" },
          routeKeys: [
            "route_installation_maintenance_apprenticeship",
            "route_domestic_apprenticeship",
            "route_college_workplace_bridge",
          ],
        },
      ],
    },
  ],

  localRequirements: [],

  review: {},

  scenarios: [
    {
      /* Already recognised as qualified: the direct route is open, with the
       * site-tolerance condition held at verification because the only evidence
       * for it is general guidance. */
      scenarioKey: "scenario_qualified_electrician_direct",
      answers: [
        { question: Q_NATION, value: "england" },
        { question: Q_YEARS, value: 8 },
        { question: Q_SCOPE, value: "installation_maintenance" },
        { question: Q_EVIDENCE_CAPACITY, value: "able" },
        { question: Q_LEVEL2_THEORY, value: "held" },
        { question: Q_QUALIFIED_COMPETENCE, value: "held" },
        { question: Q_TRAINING_COMMITMENT, value: "able" },
        { question: Q_SITE_TOLERANCE, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_qualified_electrician_direct",
          eligibility: true,
        },
        {
          kind: "requirement_state_is",
          requirementKey: "req_recognised_qualified_competence",
          state: "met",
        },
        {
          kind: "requirement_state_is",
          requirementKey: "req_physical_site_tolerance",
          state: "verification_required",
        },
      ],
    },
    {
      /* Experienced installation electrician without recognised competence:
       * the experience-led assessment route is eligible. */
      scenarioKey: "scenario_installation_ewa_experienced",
      answers: [
        { question: Q_NATION, value: "england" },
        { question: Q_YEARS, value: 6 },
        { question: Q_SCOPE, value: "installation_maintenance" },
        { question: Q_EVIDENCE_CAPACITY, value: "able" },
        { question: Q_LEVEL2_THEORY, value: "held" },
        { question: Q_QUALIFIED_COMPETENCE, value: "not_held" },
        { question: Q_TRAINING_COMMITMENT, value: "able" },
        { question: Q_SITE_TOLERANCE, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_installation_maintenance_ewa",
          eligibility: true,
        },
        {
          kind: "route_eligibility_is",
          routeKey: "route_qualified_electrician_direct",
          eligibility: false,
        },
        {
          kind: "action_present",
          actionKey: "action_confirm_ewa_eligibility_with_assessment_centre",
        },
      ],
    },
    {
      /* Domestic installer with four years: the domestic assessment route is
       * eligible while the installation route is legitimately short of years. */
      scenarioKey: "scenario_domestic_ewa_experienced",
      answers: [
        { question: Q_NATION, value: "wales" },
        { question: Q_YEARS, value: 4 },
        { question: Q_SCOPE, value: "domestic" },
        { question: Q_EVIDENCE_CAPACITY, value: "able" },
        { question: Q_LEVEL2_THEORY, value: "held" },
        { question: Q_QUALIFIED_COMPETENCE, value: "not_held" },
        { question: Q_TRAINING_COMMITMENT, value: "able" },
        { question: Q_SITE_TOLERANCE, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        { kind: "route_eligibility_is", routeKey: "route_domestic_ewa", eligibility: true },
        {
          kind: "route_eligibility_is",
          routeKey: "route_installation_maintenance_ewa",
          eligibility: false,
        },
        {
          kind: "barrier_present",
          barrierKey: "barrier_installation_ewa_practising_years_short",
        },
      ],
    },
    {
      /* New entrant: training routes remain open. A blocked assessment route
       * never becomes an overall negative judgement. */
      scenarioKey: "scenario_new_entrant_training_routes",
      answers: [
        { question: Q_NATION, value: "england" },
        { question: Q_YEARS, value: 0 },
        { question: Q_SCOPE, value: "not_practising" },
        { question: Q_EVIDENCE_CAPACITY, value: "unable" },
        { question: Q_LEVEL2_THEORY, value: "not_held" },
        { question: Q_QUALIFIED_COMPETENCE, value: "not_held" },
        { question: Q_TRAINING_COMMITMENT, value: "able" },
        { question: Q_SITE_TOLERANCE, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_installation_maintenance_apprenticeship",
          eligibility: true,
        },
        {
          kind: "route_eligibility_is",
          routeKey: "route_installation_maintenance_ewa",
          eligibility: false,
        },
        { kind: "action_present", actionKey: "action_apply_for_electrical_apprenticeship" },
        {
          kind: "barrier_present",
          barrierKey: "barrier_college_study_alone_not_full_competence",
        },
      ],
    },
    {
      /* Scotland: the English/Welsh/Northern Irish assessment routes are declared
       * out of scheme scope rather than silently applied, and the Scottish route
       * is unresolved rather than negative. */
      scenarioKey: "scenario_scotland_no_scheme_generalisation",
      answers: [
        { question: Q_NATION, value: "scotland" },
        { question: Q_YEARS, value: 6 },
        { question: Q_SCOPE, value: "installation_maintenance" },
        { question: Q_EVIDENCE_CAPACITY, value: "able" },
        { question: Q_LEVEL2_THEORY, value: "held" },
        { question: Q_QUALIFIED_COMPETENCE, value: "not_held" },
        { question: Q_TRAINING_COMMITMENT, value: "able" },
        { question: Q_SITE_TOLERANCE, value: "able" },
      ],
      expect: [
        { kind: "judgement_is", judgement: "realistic_with_conditions" },
        { kind: "unresolved_check_present", checkKey: "check_scotland_route_verification" },
        { kind: "action_present", actionKey: "action_check_scottish_electrotechnical_route" },
        {
          kind: "route_eligibility_is",
          routeKey: "route_scotland_electrotechnical_verification",
          eligibility: true,
        },
      ],
    },
  ],
});
