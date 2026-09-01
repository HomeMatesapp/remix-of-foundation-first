import { ARCHITECTURE_TEST_PACKS } from "../career-packs/architecture-tests";
import { parseCareerResultCopySet } from "../../features/reality-check-result/content-schema";

/**
 * Increment 16 — participant-facing Reality Check RESULT copy for the four
 * architecture-test careers.
 *
 * Every string is descriptive presentation wording for a stable key the bound
 * Career Pack already declares. Nothing here decides anything: requirement
 * states, route availability, ordering and the judgement all come from the
 * Decision Engine, and this file cannot change any of them.
 *
 * Wording rules applied throughout:
 * - never claim a place, a job, an outcome or a timescale;
 * - never say a career is impossible;
 * - where a decision belongs to a regulator, employer, provider or assessment
 *   centre, say so plainly instead of implying Clear Routes has settled it;
 * - `beforeYouSpend` warns before money or time is committed and promises
 *   nothing.
 *
 * Two-way stable-key coverage against the bound Career Packs is checked at load
 * here and fails closed. Exact canonical CONTENT-HASH binding is enforced by the
 * server-only `architecture-tests.server.ts` load (the only path that can
 * produce a participant result) and again at runtime; canonical hashing is
 * deliberately server-side, so this browser-safe module never re-hashes a pack.
 */
export const AUTHORED_ARCHITECTURE_TEST_RESULT_COPY: readonly unknown[] = [
  {
    occupationKey: "registered_nurse",
    careerPackId: "9a1e0001-0001-4000-8000-000000000001",
    /* Reviewed against this exact Career Pack version. */
    careerPackVersion: "1.0.0",
    /* Reviewed against this exact canonical Career Pack content hash. */
    careerPackContentHash: "6f8f78d26b79ec19a8a674f157c1eb406fe576ff6528123438bf67990edfe215",
    careerTitle: "Registered Nurse",
    routes: [
      {
        routeKey: "route_registered_practice",
        label: "Already registered with the NMC",
        beforeYouSpend:
          "Before paying for anything, check your registration is current with the regulator, because nothing else in this route works without it.",
      },
      {
        routeKey: "route_nmc_approved_degree",
        label: "NMC-approved nursing degree",
        beforeYouSpend:
          "Before committing money or time to a course, confirm with the university that the programme is NMC-approved and that they would consider your qualifications.",
      },
      {
        routeKey: "route_nurse_degree_apprenticeship",
        label: "Registered nurse degree apprenticeship",
        beforeYouSpend:
          "This route depends on an employer employing and supporting you, so treat it as available only once an employer has confirmed it with you.",
      },
      {
        routeKey: "route_nursing_associate_bridge",
        label: "Bridging from nursing associate",
        beforeYouSpend:
          "Before committing, ask the approved education institution exactly what it would accept from your nursing associate background, because that is its decision and not a national rule.",
      },
      {
        routeKey: "route_overseas_registration",
        label: "Registration after qualifying outside the UK",
        beforeYouSpend:
          "Before paying course or relocation costs, start the regulator's own verification of your overseas qualification, because only the regulator can decide the outcome.",
      },
    ],
    requirements: [
      {
        requirementKey: "req_nmc_registration_held",
        label: "Current NMC registration",
        met: "You have said you hold current NMC registration.",
        gap: "Practising as a registered nurse requires current registration with the regulator, and that is not settled here.",
      },
      {
        requirementKey: "req_approved_programme_entry",
        label: "Entry to an NMC-approved programme",
        met: "You have said an approved programme would take you at your current level of qualification.",
        gap: "Entry to a specific approved programme is decided by the university running it, so it needs checking with them directly.",
      },
      {
        requirementKey: "req_apprenticeship_employer_support",
        label: "An employer to support the apprenticeship",
        met: "You have said an employer would employ and support you through the apprenticeship.",
        gap: "This apprenticeship only exists with an employer behind it, so employer support needs confirming before the route means anything.",
      },
      {
        requirementKey: "req_nursing_associate_background",
        label: "Nursing associate background",
        met: "You have said you have a nursing associate background to build on.",
        gap: "This bridging route builds on nursing associate experience, which is not something you have described.",
      },
      {
        requirementKey: "req_overseas_competence_verification",
        label: "Verification of an overseas qualification",
        met: "You have said your overseas qualification has been verified against the regulator's standards.",
        gap: "A qualification gained outside the UK is assessed by the regulator against its own standards, and only the regulator can complete that.",
      },
      {
        requirementKey: "req_study_commitment",
        label: "Capacity to study",
        met: "You have said you could commit to the study this route involves.",
        gap: "This route involves sustained academic study, and you have not said you could commit to that yet.",
      },
      {
        requirementKey: "req_clinical_placement_commitment",
        label: "Capacity for clinical placements",
        met: "You have said you could commit to supervised clinical placements.",
        gap: "Approved programmes include supervised clinical placements, and you have not said you could commit to those yet.",
      },
    ],
    barriers: [
      {
        barrierKey: "barrier_declared_health_character_issue",
        label: "A health or character matter you have declared",
        explanation:
          "The regulator assesses health and character declarations itself. Declaring something does not decide the outcome, and nothing here predicts what the regulator will conclude.",
      },
    ],
    checks: [
      {
        checkKey: "check_health_character_review",
        issue: "How the regulator will treat what you have declared",
        whyItMatters:
          "Registration follows a health and character assessment, so an undeclared or unassessed matter leaves the position genuinely unknown.",
        whatCouldResolveIt:
          "Only the regulator's own assessment of your declaration can settle this.",
      },
      {
        checkKey: "check_approved_programme_entry_verification",
        issue: "Whether a specific approved programme would accept you",
        whyItMatters:
          "Entry criteria are set by each approved education institution, so a national statement cannot answer it.",
        whatCouldResolveIt:
          "Asking the admissions team of the programmes you are considering about your exact qualifications.",
      },
      {
        checkKey: "check_apprenticeship_employer_confirmation",
        issue: "Whether an employer would employ and support you",
        whyItMatters:
          "The apprenticeship route depends entirely on an employer, so without one there is nothing to be eligible for.",
        whatCouldResolveIt:
          "An employer confirming directly that they would employ and support you.",
      },
      {
        checkKey: "check_overseas_registration_verification",
        issue: "How your overseas qualification compares to the regulator's standards",
        whyItMatters:
          "The regulator assesses overseas qualifications individually, so the comparison cannot be assumed.",
        whatCouldResolveIt: "Beginning the regulator's own verification process.",
      },
      {
        checkKey: "check_local_approved_programme_access",
        issue: "Whether an approved programme is realistically reachable for you",
        whyItMatters:
          "An approved programme you cannot practically attend cannot be treated as an open route for you.",
        whatCouldResolveIt:
          "Looking at which approved programmes you could actually travel to or move for.",
      },
      {
        checkKey: "check_study_and_placement_commitment_review",
        issue: "Whether you could sustain the study and placement commitment",
        whyItMatters:
          "The commitment is substantial, so an unclear answer here matters more than it looks.",
        whatCouldResolveIt:
          "Thinking through your finances, caring responsibilities and working pattern against the commitment this route involves.",
      },
    ],
    actions: [
      {
        actionKey: "action_verify_approved_programme_entry",
        label: "Ask an approved programme what it would accept",
        guidance:
          "Contact the admissions teams of NMC-approved programmes you could attend and ask directly about your qualifications.",
      },
      {
        actionKey: "action_declare_health_character_to_regulator",
        label: "Raise your health or character declaration with the regulator",
        guidance:
          "The regulator assesses declarations itself, and raising it early means you find out where you stand sooner.",
      },
      {
        actionKey: "action_begin_overseas_registration_verification",
        label: "Start verification of your overseas qualification",
        guidance:
          "Begin the regulator's verification process before committing to relocation or further study.",
      },
      {
        actionKey: "action_confirm_apprenticeship_employer_support",
        label: "Confirm employer support directly",
        guidance:
          "Ask the employer to confirm that they would employ and support you through the apprenticeship.",
      },
    ],
    factors: [
      {
        factorKey: "factor_registration_already_held",
        statement: "You have said you already hold current registration as a nurse.",
      },
      {
        factorKey: "factor_nursing_associate_starting_point",
        statement: "You have said you are registered as a nursing associate.",
      },
      {
        factorKey: "factor_overseas_qualified_starting_point",
        statement: "You have said you qualified as a nurse outside the UK.",
      },
    ],
    /*
     * PRESENTATION-ONLY next-step order. It cannot trigger an action, and it
     * is used only for actions the engine has already triggered.
     */
  },

  {
    occupationKey: "electrician",
    careerPackId: "9a1e0002-0002-4000-8000-000000000002",
    /* Reviewed against this exact Career Pack version. */
    careerPackVersion: "1.0.0",
    /* Reviewed against this exact canonical Career Pack content hash. */
    careerPackContentHash: "4691e4fc3ef5bd2fc1904cf1f320614d4896d4453476738e464ca53ec36a4055",
    careerTitle: "Electrician",
    routes: [
      {
        routeKey: "route_qualified_electrician_direct",
        label: "Already holding recognised electrical competence",
        beforeYouSpend:
          "Before paying for further training, check what your existing certification already covers, because you may not need it.",
      },
      {
        routeKey: "route_installation_maintenance_apprenticeship",
        label: "Installation and maintenance electrician apprenticeship",
        beforeYouSpend:
          "This is employed training, so an employer has to take you on; entry criteria vary between employers and providers and are not set nationally.",
      },
      {
        routeKey: "route_domestic_apprenticeship",
        label: "Domestic electrician apprenticeship",
        beforeYouSpend:
          "This is employed training focused on domestic work, so check with the employer what the qualification would and would not cover you for.",
      },
      {
        routeKey: "route_installation_maintenance_ewa",
        label: "Experienced Worker Assessment — installation and maintenance",
        beforeYouSpend:
          "Before paying assessment fees, get an assessment centre to confirm your eligibility, because the centre decides it and the criteria are strict.",
      },
      {
        routeKey: "route_domestic_ewa",
        label: "Experienced Worker Assessment — domestic",
        beforeYouSpend:
          "Before paying assessment fees, get an assessment centre to confirm your eligibility for the domestic scope specifically.",
      },
      {
        routeKey: "route_college_workplace_bridge",
        label: "College study alongside workplace experience",
        beforeYouSpend:
          "College study on its own does not amount to recognised occupational competence, so be clear what a course leads to before you pay for it.",
      },
      {
        routeKey: "route_scotland_electrotechnical_verification",
        label: "Scotland — separate verification route",
        beforeYouSpend:
          "Arrangements in Scotland are set separately, so verify the route in Scotland before committing to anything based on arrangements elsewhere.",
      },
    ],
    requirements: [
      {
        requirementKey: "req_recognised_qualified_competence",
        label: "Recognised occupational competence",
        met: "You have said you already hold recognised electrical competence.",
        gap: "Working as a qualified electrician rests on recognised occupational competence, which is not something you have described holding.",
      },
      {
        requirementKey: "req_ewa_installation_practising_years",
        label: "Five years practising installation and maintenance work",
        met: "You have described at least five years practising in installation and maintenance work.",
        gap: "This assessment route requires at least five years practising in that scope, and time spent in training does not count towards it.",
      },
      {
        requirementKey: "req_ewa_domestic_practising_years",
        label: "Three years practising domestic installation work",
        met: "You have described at least three years practising in domestic installation work.",
        gap: "The domestic assessment route requires at least three years practising in domestic installation work, and training time does not count towards it.",
      },
      {
        requirementKey: "req_ewa_level2_theory",
        label: "Underpinning electrical theory",
        met: "You have said you hold the underpinning electrical theory this assessment expects.",
        gap: "The assessment expects underpinning electrical theory, which is not something you have described holding.",
      },
      {
        requirementKey: "req_ewa_current_practice_installation",
        label: "Currently working in installation and maintenance",
        met: "You have said you are currently working in installation and maintenance work.",
        gap: "This route assumes you are currently working in that scope, which is not what you have described.",
      },
      {
        requirementKey: "req_ewa_current_practice_domestic",
        label: "Currently working in domestic installation",
        met: "You have said you are currently working in domestic installation work.",
        gap: "The domestic route assumes you are currently working in domestic installation, which is not what you have described.",
      },
      {
        requirementKey: "req_ewa_workplace_evidence_capacity",
        label: "Access to workplace evidence",
        met: "You have said you could gather evidence of your own work in the workplace.",
        gap: "The assessment is evidence-based, so being able to gather evidence of your own work matters, and that is not settled here.",
      },
      {
        requirementKey: "req_employer_entry_criteria",
        label: "An employer's own entry criteria",
        met: "You have described a starting point an employer might work with.",
        gap: "Entry criteria are set by each employer and provider, so they vary and cannot be answered nationally.",
      },
      {
        requirementKey: "req_training_commitment",
        label: "Capacity for employed training",
        met: "You have said you could commit to training while employed.",
        gap: "This route means training while working over an extended period, and you have not said you could commit to that yet.",
      },
      {
        requirementKey: "req_domestic_training_commitment",
        label: "Capacity for domestic-focused training",
        met: "You have said you could commit to the domestic training route.",
        gap: "The domestic route still means employed training over time, and you have not said you could commit to that yet.",
      },
      {
        requirementKey: "req_physical_site_tolerance",
        label: "Working conditions on site",
        met: "You have said the physical conditions of the work would be workable for you.",
        gap: "Electrical work often involves height, confined spaces and physical site conditions, and how workable that is for you is not settled here.",
      },
    ],
    barriers: [
      {
        barrierKey: "barrier_college_study_alone_not_full_competence",
        label: "College study on its own is not full competence",
        explanation:
          "A college qualification alone does not amount to recognised occupational competence. It can be a genuine step, but it is not the finish line.",
      },
      {
        barrierKey: "barrier_installation_ewa_practising_years_short",
        label: "Practising experience below the assessment threshold",
        explanation:
          "The installation and maintenance assessment sets a five-year practising threshold. Being below it today is an outstanding condition, not a closed career.",
      },
    ],
    checks: [
      {
        checkKey: "check_ewa_provider_eligibility_verification",
        issue: "Whether an assessment centre would accept you",
        whyItMatters:
          "Eligibility for the assessment is confirmed by the assessment centre, so it cannot be settled here.",
        whatCouldResolveIt:
          "Contacting an assessment centre with an honest account of your experience and theory.",
      },
      {
        checkKey: "check_recognised_competence_verification",
        issue: "What your existing certification actually covers",
        whyItMatters:
          "Scope matters: certification for one kind of work does not automatically cover another.",
        whatCouldResolveIt: "Checking your certification against the scheme's own definitions.",
      },
      {
        checkKey: "check_scotland_route_verification",
        issue: "How the route works in Scotland",
        whyItMatters:
          "Arrangements in Scotland are set separately, and applying arrangements from elsewhere would be misleading.",
        whatCouldResolveIt:
          "Verifying the current arrangements for Scotland before committing to a plan.",
      },
    ],
    actions: [
      {
        actionKey: "action_confirm_ewa_eligibility_with_assessment_centre",
        label: "Ask an assessment centre whether you are eligible",
        guidance:
          "Do this before paying fees: the centre decides eligibility, and its answer changes what is worth planning.",
      },
      {
        actionKey: "action_apply_for_electrical_apprenticeship",
        label: "Look for an employer offering an apprenticeship",
        guidance:
          "Employed training depends on an employer taking you on, and their criteria vary, so ask several.",
      },
      {
        actionKey: "action_obtain_level2_electrical_theory",
        label: "Build the underpinning electrical theory",
        guidance:
          "Theory is expected by the assessment route, so getting it in place keeps that route open to you.",
      },
      {
        actionKey: "action_check_scottish_electrotechnical_route",
        label: "Check the Scottish route directly",
        guidance:
          "Confirm how the route works in Scotland before you commit money or time on the basis of arrangements elsewhere.",
      },
    ],
    factors: [
      {
        factorKey: "factor_recognised_competence_already_held",
        statement: "You have said you already hold recognised electrical competence.",
      },
      {
        factorKey: "factor_installation_ewa_criteria_evidenced",
        statement:
          "What you have described matches the installation and maintenance assessment criteria.",
      },
      {
        factorKey: "factor_domestic_ewa_criteria_evidenced",
        statement: "What you have described matches the domestic assessment criteria.",
      },
      {
        factorKey: "factor_new_entrant_training_route",
        statement: "You have described starting out rather than already working in the trade.",
      },
    ],
  },

  {
    occupationKey: "solicitor_england_wales",
    careerPackId: "9a1e0003-0003-4000-8000-000000000003",
    /* Reviewed against this exact Career Pack version. */
    careerPackVersion: "1.0.0",
    /* Reviewed against this exact canonical Career Pack content hash. */
    careerPackContentHash: "00fda877db9e7232b714ad7ad47f7615743caea8feb0df78264d5b1933ce8fa6",
    careerTitle: "Solicitor of England and Wales",
    routes: [
      {
        routeKey: "route_sqe_standard",
        label: "Degree or equivalent plus the SQE",
        beforeYouSpend:
          "Preparation courses are not the same thing as the regulator\u2019s own assessments, so be clear which of the two you are paying for.",
      },
      {
        routeKey: "route_solicitor_apprenticeship_non_graduate",
        label: "Solicitor apprenticeship without a degree first",
        beforeYouSpend:
          "This route depends on an employer taking you on as an apprentice, so treat it as open only once an employer says so.",
      },
      {
        routeKey: "route_solicitor_apprenticeship_graduate",
        label: "Solicitor apprenticeship after a degree",
        beforeYouSpend:
          "Employers set their own recruitment for these places, so confirm what a specific employer expects before planning around it.",
      },
      {
        routeKey: "route_lpc_transitional",
        label: "Transitional route through the previous qualification",
        beforeYouSpend:
          "Transitional arrangements apply only to a defined group, so verify with the regulator that they apply to you before paying for anything.",
      },
    ],
    requirements: [
      {
        requirementKey: "req_degree_or_equivalent",
        label: "A degree or equivalent qualification",
        met: "You have said you hold a degree or a qualification you consider equivalent.",
        gap: "Admission rests on a degree or an equivalent qualification, and whether something counts as equivalent is the regulator's decision.",
      },
      {
        requirementKey: "req_sra_suitability",
        label: "The regulator's suitability assessment",
        met: "You have said you know of nothing that would affect the suitability assessment.",
        gap: "Suitability is assessed by the regulator for every route, and it is not something that can be settled here.",
      },
      {
        requirementKey: "req_sqe1_passed",
        label: "SQE1",
        met: "You have said you have passed SQE1.",
        gap: "SQE1 has to be passed to qualify. Not having taken it yet is a stage you have not reached, not a closed door.",
      },
      {
        requirementKey: "req_sqe2_passed",
        label: "SQE2",
        met: "You have said you have passed SQE2.",
        gap: "SQE2 has to be passed for admission. Not having taken it yet is a stage you have not reached, not a closed door.",
      },
      {
        requirementKey: "req_qualifying_work_experience",
        label: "Two years of qualifying work experience",
        met: "You have described the qualifying work experience this route expects.",
        gap: "Two years of full-time equivalent qualifying work experience is required, and it can be built up over time in more than one place.",
      },
      {
        requirementKey: "req_lpc_transitional_eligibility",
        label: "Eligibility for transitional arrangements",
        met: "You have said you fall within the transitional arrangements.",
        gap: "Transitional arrangements apply only to a defined group, and whether you are in it needs verifying with the regulator.",
      },
      {
        requirementKey: "req_legal_work_setting",
        label: "Access to legal work",
        met: "You have described access to legal work of the kind this route assumes.",
        gap: "Qualifying work experience has to happen somewhere, so access to legal work matters, and that is not settled here.",
      },
    ],
    barriers: [
      {
        barrierKey: "barrier_no_degree_or_equivalent_for_admission",
        label: "No degree or equivalent qualification yet",
        explanation:
          "Admission rests on a degree or equivalent. Without one there are still routes that begin without a degree, including apprenticeships, so this is a condition rather than an ending.",
      },
    ],
    checks: [
      {
        checkKey: "check_degree_equivalence_sra_decision",
        issue: "Whether your qualification counts as degree-equivalent",
        whyItMatters:
          "Equivalence is decided by the regulator on the facts of your own qualification, so it cannot be assumed.",
        whatCouldResolveIt: "Asking the regulator for a decision on your specific qualification.",
      },
      {
        checkKey: "check_sra_suitability_disclosure",
        issue: "How the regulator will treat anything you need to disclose",
        whyItMatters:
          "Suitability applies to every route, so an unassessed disclosure leaves the position genuinely unknown.",
        whatCouldResolveIt: "Raising it with the regulator rather than waiting until admission.",
      },
      {
        checkKey: "check_lpc_transitional_verification",
        issue: "Whether transitional arrangements apply to you",
        whyItMatters:
          "They apply only to a defined group, and planning around them wrongly would cost you time and money.",
        whatCouldResolveIt: "Verifying your position with the regulator directly.",
      },
    ],
    actions: [
      {
        actionKey: "action_book_sqe1",
        label: "Plan for SQE1",
        guidance:
          "Look at what SQE1 involves and when you could realistically sit it, separately from any preparation course you are sold.",
      },
      {
        actionKey: "action_book_sqe2",
        label: "Plan for SQE2",
        guidance: "SQE2 is required for admission, so factor it into any plan you make.",
      },
      {
        actionKey: "action_accumulate_qualifying_work_experience",
        label: "Build qualifying work experience",
        guidance:
          "Two years full-time equivalent is required, and it can be built up across more than one placement or employer.",
      },
      {
        actionKey: "action_seek_sra_equivalence_decision",
        label: "Ask the regulator about degree equivalence",
        guidance:
          "Only the regulator can decide equivalence, so ask before paying for anything that assumes the answer.",
      },
      {
        actionKey: "action_disclose_suitability_to_regulator",
        label: "Raise a suitability matter early",
        guidance:
          "Raising it early means you find out where you stand before investing years in the route.",
      },
      {
        actionKey: "action_verify_transitional_eligibility",
        label: "Verify transitional eligibility",
        guidance:
          "Check with the regulator whether the transitional arrangements cover you before relying on them.",
      },
    ],
    factors: [
      {
        factorKey: "factor_non_graduate_apprenticeship_starting_point",
        statement: "You have said you would be starting an apprenticeship without a degree first.",
      },
      {
        factorKey: "factor_graduate_apprenticeship_starting_point",
        statement: "You have said you would be starting an apprenticeship as a graduate.",
      },
      {
        factorKey: "factor_confirmed_transitional_without_apprenticeship",
        statement:
          "You have said you fall within the transitional arrangements and are not seeking an apprenticeship.",
      },
      {
        factorKey: "factor_standard_sqe_when_no_apprenticeship_sought",
        statement: "You have said you are not seeking an apprenticeship.",
      },
    ],
  },

  {
    occupationKey: "photographer",
    careerPackId: "9a1e0004-0004-4000-8000-000000000004",
    /* Reviewed against this exact Career Pack version. */
    careerPackVersion: "1.0.0",
    /* Reviewed against this exact canonical Career Pack content hash. */
    careerPackContentHash: "537fa0e12e52522a5e49d8d2b6784b266b057f9bc5b676e86d0554b5613602ec",
    careerTitle: "Photographer",
    routes: [
      {
        routeKey: "route_portfolio_experience",
        label: "Building a portfolio through experience",
        beforeYouSpend:
          "No qualification is required for this work, so be careful about paying for courses that promise entry rather than skill.",
      },
      {
        routeKey: "route_photographer_apprenticeship",
        label: "Photographer apprenticeship",
        beforeYouSpend:
          "This is employed training with a portfolio-based assessment gateway, so ask the employer what the gateway will expect of you.",
      },
      {
        routeKey: "route_higher_education_photography",
        label: "Photography course in higher education",
        beforeYouSpend:
          "A degree is a significant commitment and is not required for this work, so weigh what a course would add beyond the portfolio you could build anyway.",
      },
      {
        routeKey: "route_assistant_toward_photographer",
        label: "Starting as a photographer's assistant",
        beforeYouSpend:
          "Assisting work is arranged directly with photographers, and pay and hours vary, so check both before committing.",
      },
      {
        routeKey: "route_self_employed_photographer",
        label: "Working for yourself",
        beforeYouSpend:
          "Equipment and running costs are part of working for yourself, so look hard at the money side before you commit to it.",
      },
    ],
    requirements: [
      {
        requirementKey: "req_portfolio_evidence",
        label: "A portfolio of your own work",
        met: "You have described a portfolio of your own work.",
        gap: "Work is usually won on a portfolio rather than a qualification, so how strong yours is matters more than anything on paper.",
      },
      {
        requirementKey: "req_apprenticeship_portfolio_gateway",
        label: "The apprenticeship portfolio gateway",
        met: "You have described work that could support a portfolio-based assessment.",
        gap: "The apprenticeship includes a portfolio-based assessment gateway, so a portfolio is built during the apprenticeship rather than assumed at the start.",
      },
      {
        requirementKey: "req_variable_hours_tolerance",
        label: "Irregular hours",
        met: "You have said irregular hours would work for you.",
        gap: "The work often means evenings, weekends and unpredictable hours, and how workable that is for you is not settled here.",
      },
      {
        requirementKey: "req_equipment_access",
        label: "Access to equipment",
        met: "You have said you have access to the equipment you would need.",
        gap: "Equipment access affects what work you can take on, and hiring or borrowing may be more realistic than buying.",
      },
      {
        requirementKey: "req_self_employment_readiness",
        label: "Readiness to work for yourself",
        met: "You have said you are ready to work for yourself.",
        gap: "Much of this work is self-employed, so being ready for irregular income and finding your own clients is the real condition.",
      },
      {
        requirementKey: "req_business_admin_readiness",
        label: "Handling the business side",
        met: "You have said you could handle the business side of the work.",
        gap: "Working for yourself means quoting, invoicing, tax and chasing payment, and that is not settled here.",
      },
    ],
    barriers: [
      {
        barrierKey: "barrier_no_portfolio_for_direct_routes",
        label: "No portfolio yet",
        explanation:
          "Routes that depend on showing your work are limited without a portfolio. A portfolio can be built, so this is a starting point rather than an ending.",
      },
      {
        barrierKey: "barrier_no_equipment_access",
        label: "No access to equipment yet",
        explanation:
          "Without equipment access, paid work is hard to take on. Hiring, borrowing or working as an assistant are all ways round it.",
      },
    ],
    checks: [
      {
        checkKey: "check_portfolio_strength_review",
        issue: "How strong your portfolio actually is",
        whyItMatters:
          "Because work is won on a portfolio, its strength decides more than any qualification does.",
        whatCouldResolveIt:
          "Honest feedback on your work from photographers or clients who commission it.",
      },
      {
        checkKey: "check_self_employment_readiness_review",
        issue: "Whether self-employment is realistic for you now",
        whyItMatters:
          "Much of this work is self-employed, so income can be uncertain, and that deserves a straight answer rather than an assumption.",
        whatCouldResolveIt:
          "Working out what you need to earn each month and how long you could manage without it.",
      },
    ],
    actions: [
      {
        actionKey: "action_build_photography_portfolio",
        label: "Build your portfolio",
        guidance:
          "Deliberate, varied work you can show is what opens most of these routes, whatever else you do alongside it.",
      },
      {
        actionKey: "action_plan_self_employment_finances",
        label: "Plan the money side",
        guidance:
          "Work out your running costs and how long you could manage on irregular income before you rely on it.",
      },
      {
        actionKey: "action_apply_photographer_apprenticeship",
        label: "Look for an apprenticeship employer",
        guidance:
          "Employed training depends on an employer taking you on, so ask what their gateway assessment will expect.",
      },
      {
        actionKey: "action_review_equipment_needs",
        label: "Work out what equipment you actually need",
        guidance:
          "Hiring or borrowing is often more realistic than buying, especially before you have paid work.",
      },
    ],
    factors: [
      {
        factorKey: "factor_self_employment_ready_with_strong_portfolio",
        statement: "You have described both a portfolio and readiness to work for yourself.",
      },
      {
        factorKey: "factor_strong_portfolio_or_paid_experience",
        statement: "You have described a portfolio or paid photography experience.",
      },
      {
        factorKey: "factor_apprenticeship_chosen",
        statement: "You have said an apprenticeship is the kind of route you want.",
      },
      {
        factorKey: "factor_education_or_assistant_when_portfolio_immature",
        statement:
          "You have described being at an earlier stage, where learning or assisting fits.",
      },
    ],
  },
];

/**
 * Browser-safe parsed result copy: two-way stable-key coverage plus declared
 * Career Pack identity and version. Exact content-hash binding is NOT performed
 * here; the browser compares the authored hash against the server's own pack ref
 * through `resultCopyMatchesPackRef`.
 */
export const ARCHITECTURE_TEST_RESULT_COPY = parseCareerResultCopySet(
  AUTHORED_ARCHITECTURE_TEST_RESULT_COPY,
  ARCHITECTURE_TEST_PACKS,
);
