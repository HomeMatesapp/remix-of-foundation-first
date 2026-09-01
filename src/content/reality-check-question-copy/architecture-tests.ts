import {
  parseCareerQuestionCopySet,
  type CareerQuestionCopy,
} from "../../features/reality-check-experience/content-schema";

/**
 * ARCHITECTURE-TEST Reality Check question copy.
 *
 * Participant prompts and option labels for exactly the questions declared by
 * the four Increment 11 architecture-test Career Packs. Every option label maps
 * one-to-one onto an option key that the pack itself declares; nothing here adds
 * a question, an option, a requirement, a route, a threshold or a judgement.
 *
 * This is presentation copy only. It is never assessment truth.
 */
export const ARCHITECTURE_TEST_QUESTION_COPY: readonly CareerQuestionCopy[] =
  parseCareerQuestionCopySet([
    {
      occupationKey: "registered_nurse",
      careerPackId: "9a1e0001-0001-4000-8000-000000000001",
      careerTitle: "Registered Nurse",
      questions: [
        {
          question: { moduleCode: "registration", questionKey: "nursing_registration_status" },
          prompt: "Where are you now with nursing registration?",
          helpText: "Registration is held with the Nursing and Midwifery Council.",
          whyWeAsk: "Your starting point changes which ways into the career apply to you.",
          evidenceLater:
            "You may need to provide evidence of your registration or qualifications later.",
          options: [
            { optionKey: "registered_nurse", label: "I am already a registered nurse" },
            {
              optionKey: "registered_nursing_associate",
              label: "I am a registered nursing associate",
            },
            {
              optionKey: "overseas_qualified_nurse",
              label: "I qualified as a nurse outside the UK",
            },
            { optionKey: "not_yet_qualified", label: "I am not qualified as a nurse yet" },
          ],
        },
        {
          question: {
            moduleCode: "background_checks",
            questionKey: "health_character_declaration_status",
          },
          prompt: "Is there anything about your health or character you would need to declare?",
          helpText: "This includes cautions, convictions and health conditions you would declare.",
          whyWeAsk:
            "Declarations are handled by the regulator, so this can change what happens next.",
          evidenceLater:
            "Anything you would declare here is decided by the regulator, and you may need to provide evidence later.",
          options: [
            { optionKey: "no_known_issue", label: "Nothing that I know of" },
            { optionKey: "issue_to_declare", label: "Yes, there is something I would declare" },
            {
              optionKey: "regulator_cleared",
              label: "Yes, and the regulator has already considered it",
            },
          ],
        },
        {
          question: {
            moduleCode: "qualifications",
            questionKey: "approved_programme_entry_status",
          },
          prompt: "Have you checked the entry requirements for an approved nursing programme?",
          evidenceLater: "You may need to provide evidence of your qualifications later.",
          options: [
            { optionKey: "confirmed", label: "Yes, and I meet them" },
            { optionKey: "not_yet_checked", label: "I have not checked yet" },
            { optionKey: "known_not_met", label: "Yes, and I do not meet them yet" },
          ],
        },
        {
          question: {
            moduleCode: "qualifications",
            questionKey: "degree_apprenticeship_employer_status",
          },
          prompt: "Do you have an employer who would support a nursing degree apprenticeship?",
          helpText: "Degree apprenticeships in nursing normally need an employer to sponsor you.",
          evidenceLater: "You may need an employer to confirm this later.",
          options: [
            { optionKey: "confirmed", label: "Yes, an employer has confirmed this" },
            { optionKey: "not_confirmed", label: "No, not at the moment" },
            { optionKey: "not_applicable", label: "This way in is not relevant to me" },
          ],
        },
        {
          question: {
            moduleCode: "study_availability",
            questionKey: "substantial_study_commitment",
          },
          prompt: "Could you commit to several years of substantial study?",
          evidenceLater:
            "No evidence is needed now; this is your own judgement of what you could commit to.",
          options: [
            { optionKey: "able", label: "Yes" },
            { optionKey: "unable", label: "No" },
            { optionKey: "unsure", label: "I am not sure yet" },
          ],
        },
        {
          question: {
            moduleCode: "study_availability",
            questionKey: "clinical_placement_pattern_commitment",
          },
          prompt:
            "Could you work clinical placement patterns, including shifts, nights and weekends?",
          whyWeAsk: "Placements are part of the programme, not an optional extra.",
          evidenceLater:
            "No evidence is needed now; this is your own judgement of what you could commit to.",
          options: [
            { optionKey: "able", label: "Yes" },
            { optionKey: "unable", label: "No" },
            { optionKey: "unsure", label: "I am not sure yet" },
          ],
        },
      ],
    },
    {
      occupationKey: "electrician",
      careerPackId: "9a1e0002-0002-4000-8000-000000000002",
      careerTitle: "Electrician",
      questions: [
        {
          question: { moduleCode: "travel_relocation", questionKey: "uk_nation" },
          prompt: "Which UK nation would you be training or working in?",
          whyWeAsk: "Some ways into this career work differently across the four UK nations.",
          evidenceLater:
            "No evidence is needed now; you may need to confirm where you are based later.",
          options: [
            { optionKey: "england", label: "England" },
            { optionKey: "wales", label: "Wales" },
            { optionKey: "northern_ireland", label: "Northern Ireland" },
            { optionKey: "scotland", label: "Scotland" },
          ],
        },
        {
          question: {
            moduleCode: "experience",
            questionKey: "practising_years_excluding_training",
          },
          prompt:
            "How many years have you worked as an electrician, not counting time in training?",
          helpText: "Enter whole years. Enter 0 if you have not worked as an electrician.",
          evidenceLater: "You may need to provide evidence of your work history later.",
          valueHint: "Years",
        },
        {
          question: { moduleCode: "experience", questionKey: "current_work_scope" },
          prompt: "What kind of electrical work are you doing at the moment?",
          evidenceLater:
            "You may need to provide evidence of your current work and experience later.",
          options: [
            { optionKey: "installation_maintenance", label: "Installation and maintenance work" },
            { optionKey: "domestic", label: "Work in people's homes" },
            { optionKey: "both", label: "Both kinds of work" },
            { optionKey: "not_practising", label: "I am not doing electrical work at the moment" },
          ],
        },
        {
          question: { moduleCode: "experience", questionKey: "workplace_evidence_capacity" },
          prompt: "Could you gather evidence of your own work on site for assessment?",
          helpText: "Some ways in are assessed using real jobs you have completed at work.",
          evidenceLater:
            "No evidence is needed now; if you take this way in, your own completed work would be assessed later.",
          options: [
            { optionKey: "able", label: "Yes" },
            { optionKey: "unable", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: {
            moduleCode: "qualifications",
            questionKey: "level2_electrical_theory_status",
          },
          prompt: "Do you hold a Level 2 electrical theory qualification?",
          evidenceLater: "You may need to provide evidence of this qualification later.",
          options: [
            { optionKey: "held", label: "Yes" },
            { optionKey: "not_held", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: {
            moduleCode: "qualifications",
            questionKey: "recognised_qualified_competence_status",
          },
          prompt: "Do you hold a recognised qualified-electrician competence qualification?",
          helpText: "This is the qualification that shows you are a fully qualified electrician.",
          evidenceLater:
            "You may need to provide evidence of this qualification or recognised competence later.",
          options: [
            { optionKey: "held", label: "Yes" },
            { optionKey: "not_held", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: { moduleCode: "study_availability", questionKey: "training_commitment" },
          prompt: "Could you commit to structured training alongside work?",
          evidenceLater:
            "No evidence is needed now; this is your own judgement of what you could commit to.",
          options: [
            { optionKey: "able", label: "Yes" },
            { optionKey: "unable", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: {
            moduleCode: "physical_work_pattern",
            questionKey: "height_confined_space_tolerance",
          },
          prompt: "Are you able to work at height and in confined spaces?",
          evidenceLater:
            "No evidence is needed for this answer; this is your own judgement of what you could manage.",
          options: [
            { optionKey: "able", label: "Yes" },
            { optionKey: "unable", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
      ],
    },
    {
      occupationKey: "solicitor_england_wales",
      careerPackId: "9a1e0003-0003-4000-8000-000000000003",
      careerTitle: "Solicitor of England and Wales",
      questions: [
        {
          question: { moduleCode: "qualifications", questionKey: "degree_or_equivalent_status" },
          prompt: "Where are you with a degree or an equivalent qualification?",
          helpText: "It does not have to be a law degree.",
          evidenceLater:
            "You may need to provide evidence of your qualification later, and anything treated as equivalent is decided by the regulator.",
          options: [
            {
              optionKey: "confirmed_level6_plus",
              label: "I hold a degree or a Level 6 qualification",
            },
            {
              optionKey: "equivalence_needs_sra_decision",
              label: "I hold something that may count, but it would need to be assessed",
            },
            { optionKey: "none", label: "I do not hold one yet" },
          ],
        },
        {
          question: { moduleCode: "qualifications", questionKey: "sqe1_status" },
          prompt: "Have you passed SQE1?",
          helpText: "SQE1 is the first stage of the Solicitors Qualifying Examination.",
          evidenceLater: "You may need to provide evidence of your result later.",
          options: [
            { optionKey: "passed", label: "Yes" },
            { optionKey: "not_yet_taken", label: "Not yet" },
          ],
        },
        {
          question: { moduleCode: "qualifications", questionKey: "sqe2_status" },
          prompt: "Have you passed SQE2?",
          helpText: "SQE2 is the second, practical stage of the examination.",
          evidenceLater: "You may need to provide evidence of your result later.",
          options: [
            { optionKey: "passed", label: "Yes" },
            { optionKey: "not_yet_taken", label: "Not yet" },
          ],
        },
        {
          question: {
            moduleCode: "qualifications",
            questionKey: "lpc_transitional_eligibility_status",
          },
          prompt: "Can you still use the older LPC route instead of the SQE?",
          helpText: "The older route is only open to people who had already started it.",
          evidenceLater:
            "You may need to confirm this later; the regulator decides who can still use the older route.",
          options: [
            { optionKey: "confirmed_eligible", label: "Yes, I have been told I can" },
            { optionKey: "not_eligible", label: "No" },
            { optionKey: "not_sure", label: "I am not sure" },
          ],
        },
        {
          question: {
            moduleCode: "experience",
            questionKey: "qualifying_work_experience_months",
          },
          prompt: "How many months of qualifying legal work experience do you have?",
          helpText: "Enter whole months. Enter 0 if you have none yet.",
          evidenceLater:
            "You may need this experience confirmed later by someone authorised to confirm it.",
          valueHint: "Months",
        },
        {
          question: { moduleCode: "experience", questionKey: "apprenticeship_starting_point" },
          prompt:
            "If you were looking at a solicitor apprenticeship, where would you be starting from?",
          evidenceLater: "You may need to provide evidence of your qualification status later.",
          options: [
            { optionKey: "non_graduate", label: "I am not a graduate" },
            { optionKey: "graduate", label: "I am a graduate" },
            {
              optionKey: "not_seeking_apprenticeship",
              label: "I am not looking at an apprenticeship",
            },
          ],
        },
        {
          question: { moduleCode: "background_checks", questionKey: "sra_suitability_status" },
          prompt:
            "Is there anything about your character or past conduct you would need to disclose?",
          whyWeAsk: "The regulator decides on disclosures, so this can change what happens next.",
          evidenceLater:
            "Anything you would disclose here is decided by the regulator, and you may need to provide evidence later.",
          options: [
            { optionKey: "no_known_issue", label: "Nothing that I know of" },
            { optionKey: "issue_to_disclose", label: "Yes, there is something I would disclose" },
            {
              optionKey: "regulator_cleared",
              label: "Yes, and the regulator has already considered it",
            },
          ],
        },
        {
          question: { moduleCode: "employment_income", questionKey: "legal_employment_status" },
          prompt: "Are you working in a legal role at the moment?",
          evidenceLater:
            "No evidence is needed now; you may need to provide evidence of this work later.",
          options: [
            { optionKey: "in_legal_role", label: "Yes, I am in a legal role" },
            { optionKey: "offer_held", label: "I have an offer but have not started" },
            { optionKey: "none", label: "No" },
          ],
        },
      ],
    },
    {
      occupationKey: "photographer",
      careerPackId: "9a1e0004-0004-4000-8000-000000000004",
      careerTitle: "Photographer",
      questions: [
        {
          question: { moduleCode: "portfolio", questionKey: "portfolio_maturity" },
          prompt: "How developed is your photography portfolio?",
          helpText: "A portfolio is the set of work you would show to a client or a course.",
          evidenceLater:
            "No evidence is needed now; you would normally be asked to show your portfolio later.",
          options: [
            { optionKey: "none", label: "I do not have one yet" },
            { optionKey: "developing", label: "I have one and it is still developing" },
            { optionKey: "strong", label: "I have a strong portfolio" },
          ],
        },
        {
          question: { moduleCode: "portfolio", questionKey: "equipment_access" },
          prompt: "Do you have access to the camera equipment you would need?",
          evidenceLater:
            "No evidence is needed for this answer; this is your own judgement of the equipment you can use.",
          options: [
            { optionKey: "adequate", label: "Yes, enough for the work I want to do" },
            { optionKey: "limited", label: "Some, but not enough" },
            { optionKey: "none", label: "No" },
          ],
        },
        {
          question: { moduleCode: "experience", questionKey: "paid_photography_experience" },
          prompt: "Have you been paid for photography work?",
          evidenceLater:
            "No evidence is needed for this answer; it records your own paid work so far.",
          options: [
            { optionKey: "none", label: "Not yet" },
            { optionKey: "some", label: "A little" },
            { optionKey: "substantial", label: "A lot" },
          ],
        },
        {
          question: { moduleCode: "employment_income", questionKey: "self_employment_readiness" },
          prompt: "Would you be ready to work for yourself?",
          whyWeAsk: "Much photography work is self-employed rather than salaried.",
          evidenceLater: "No evidence is needed now; this is your own judgement.",
          options: [
            { optionKey: "ready", label: "Yes" },
            { optionKey: "not_ready", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: { moduleCode: "employment_income", questionKey: "business_admin_readiness" },
          prompt: "Would you be ready to handle quotes, invoices and tax?",
          evidenceLater: "No evidence is needed now; this is your own judgement.",
          options: [
            { optionKey: "ready", label: "Yes" },
            { optionKey: "not_ready", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: {
            moduleCode: "physical_work_pattern",
            questionKey: "variable_hours_tolerance",
          },
          prompt: "Could you work irregular hours, including evenings and weekends?",
          evidenceLater:
            "No evidence is needed now; this is your own judgement of what you could manage.",
          options: [
            { optionKey: "able", label: "Yes" },
            { optionKey: "unable", label: "No" },
            { optionKey: "unsure", label: "I am not sure" },
          ],
        },
        {
          question: { moduleCode: "study_availability", questionKey: "apprenticeship_interest" },
          prompt: "Are you interested in a photography apprenticeship?",
          evidenceLater:
            "No evidence is needed for this answer; it records what you are interested in.",
          options: [
            { optionKey: "seeking", label: "Yes" },
            { optionKey: "not_seeking", label: "No" },
          ],
        },
        {
          question: { moduleCode: "study_availability", questionKey: "higher_education_interest" },
          prompt: "Are you interested in a college or university photography course?",
          evidenceLater:
            "No evidence is needed for this answer; it records what you are interested in.",
          options: [
            { optionKey: "seeking", label: "Yes" },
            { optionKey: "not_seeking", label: "No" },
          ],
        },
      ],
    },
  ]);
