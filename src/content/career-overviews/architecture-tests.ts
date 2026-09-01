import { parseCareerOverviews } from "../../features/career-discovery/content-schema";

/**
 * Participant-facing career overview content for the four Increment 11
 * architecture-test occupations.
 *
 * Every figure and characteristic below is authored from the National Careers
 * Service job profile named in `sources`, checked 2026-08-26, or from the
 * Increment 11 authoritative provenance record for that occupation. Nothing here
 * is fetched at runtime, and nothing here is consequential Reality Check truth:
 * these strings are descriptive context only.
 *
 * Deliberately absent: any demand rating, suitability score, route score, local
 * availability claim, provider claim or eligibility statement.
 */

const CHECKED_AT = "2026-08-26";

export const ARCHITECTURE_TEST_CAREER_OVERVIEWS = parseCareerOverviews([
  {
    occupation: {
      occupationId: "0c1f1b64-9d5a-4a4c-9a0f-1f0a5d3c9b01",
      occupationKey: "registered_nurse",
    },
    displayTitle: "Registered Nurse",
    summary:
      "Registered nurses assess, plan and deliver care for patients, working within standards set by the Nursing and Midwifery Council.",
    salary: { starterGbp: 32000, experiencedGbp: 48000, sourceKey: "ncs_nurse" },
    workPattern: {
      typicalHours: "37 to 42 hours a week",
      patternSummary:
        "Hours are usually worked on shifts, which can include evenings, weekends and bank holidays.",
      sourceKey: "ncs_nurse",
    },
    marketContextSummary:
      "Nursing work happens across many settings, including hospitals, clinics, hospices, care homes, people's own homes and prisons. That range describes where the role exists; it is not a promise that a particular job is open near you.",
    marketContextSourceKey: "ncs_nurse",
    dayToDay: [
      "Assessing patients, planning care and reviewing how people respond to treatment.",
      "Carrying out clinical procedures and giving medicines within professional standards.",
      "Working alongside doctors, therapists, healthcare assistants and families.",
      "Keeping accurate records and handing over care safely between shifts.",
    ],
    routeDisplays: [
      {
        routeKey: "route_registered_practice",
        sourceKeys: ["nmc_becoming_a_nurse"],
        label: "Already registered with the NMC",
        summary:
          "One route into the work: people who already hold current NMC registration can practise as a registered nurse.",
      },
      {
        routeKey: "route_nmc_approved_degree",
        sourceKeys: ["nmc_becoming_a_nurse", "nmc_approved_programmes"],
        label: "NMC-approved nursing degree",
        summary:
          "This route typically involves completing an NMC-approved pre-registration degree that combines theory with supervised clinical practice.",
      },
      {
        routeKey: "route_nurse_degree_apprenticeship",
        sourceKeys: ["skills_england_st0781", "nmc_becoming_a_nurse"],
        label: "Registered nurse degree apprenticeship",
        summary:
          "This route typically involves being employed while you study, so an employer has to support the apprenticeship.",
      },
      {
        routeKey: "route_nursing_associate_bridge",
        sourceKeys: ["nmc_becoming_a_nurse", "nmc_approved_programmes"],
        label: "Bridging from nursing associate",
        summary:
          "This route typically involves building on nursing associate experience through an NMC-approved programme; the specific programme and its entry criteria are set by the approved education institution.",
      },
      {
        routeKey: "route_overseas_registration",
        sourceKeys: ["nmc_joining_the_register"],
        label: "Registration after qualifying outside the UK",
        summary:
          "This route typically involves the NMC assessing an overseas qualification against its own standards before registration.",
      },
    ],
    appeal: [
      "Direct, visible impact on people at moments that matter to them.",
      "Very varied settings, from hospital wards to community and home-based care.",
      "Structured professional development and recognised specialist paths.",
      "Skills that are used across the whole of the UK health system.",
    ],
    challenges: [
      "The work can be emotionally demanding, including caring for people who are seriously unwell.",
      "It is physically demanding and often carried out on shifts across evenings, weekends and bank holidays.",
      "You carry real clinical responsibility and are accountable to a regulator.",
      "Registration depends on completing an approved programme, not only on wanting the role.",
    ],
    sources: [
      {
        sourceKey: "ncs_nurse",
        label: "National Careers Service — Nurse job profile",
        url: "https://nationalcareers.service.gov.uk/job-profiles/nurse",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "nmc_becoming_a_nurse",
        label: "Nursing and Midwifery Council — Becoming a nurse",
        url: "https://www.nmc.org.uk/education/becoming-a-nurse-midwife-nursing-associate/becoming-a-nurse/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "nmc_approved_programmes",
        label: "Nursing and Midwifery Council — Approved programmes",
        url: "https://www.nmc.org.uk/education/approved-programmes/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "nmc_joining_the_register",
        label: "Nursing and Midwifery Council — Joining the register",
        url: "https://www.nmc.org.uk/registration/joining-the-register/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "skills_england_st0781",
        label: "Skills England — Registered nurse degree apprenticeship (ST0781)",
        url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st0781",
        checkedAt: CHECKED_AT,
      },
    ],
  },
  {
    occupation: {
      occupationId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02",
      occupationKey: "electrician",
    },
    displayTitle: "Electrician",
    summary:
      "Electricians install, test, maintain and repair electrical systems in homes, workplaces and other buildings.",
    salary: { starterGbp: 26000, experiencedGbp: 45000, sourceKey: "ncs_electrician" },
    workPattern: {
      typicalHours: "37 to 45 hours a week",
      patternSummary: "You could be on call, depending on what customers need.",
      sourceKey: "ncs_electrician",
    },
    marketContextSummary:
      "The work spans installation, maintenance and repair, and can include lower-carbon work such as solar, electric vehicle charging and building controls. That is context about the kind of work that exists, not a claim about openings in one area.",
    marketContextSourceKey: "ncs_electrician",
    dayToDay: [
      "Reading plans and installing wiring, consumer units and fixed equipment.",
      "Diagnosing faults and repairing systems that are already in use.",
      "Testing and inspecting work so it meets safety standards.",
      "Working across different sites, often with other trades and with customers present.",
    ],
    routeDisplays: [
      {
        routeKey: "route_qualified_electrician_direct",
        sourceKeys: ["jib_ecs_scheme", "ncs_electrician"],
        label: "Already holding recognised electrical competence",
        summary:
          "One route into the work: people whose occupational competence is already recognised through the industry certification scheme.",
      },
      {
        routeKey: "route_installation_maintenance_apprenticeship",
        sourceKeys: ["skills_england_st0152", "ncs_electrician"],
        label: "Installation and maintenance electrician apprenticeship",
        summary:
          "This route typically involves employed training assessed against the installation and maintenance electrician apprenticeship standard, combining paid work with formal assessment.",
      },
      {
        routeKey: "route_domestic_apprenticeship",
        sourceKeys: ["skills_england_st1017", "ncs_electrician"],
        label: "Domestic electrician apprenticeship",
        summary:
          "This route typically involves employed training assessed against the domestic electrician apprenticeship standard, which is a separate standard from installation and maintenance and focuses on electrical work in people's homes. Employer and provider entry criteria vary.",
      },
      {
        routeKey: "route_installation_maintenance_ewa",
        sourceKeys: ["tesp_ewa_installation", "tesp_ewa_criteria"],
        label: "Experienced Worker Assessment — installation and maintenance",
        summary:
          "This route typically involves at least five years of practising experience in that scope, not counting time spent in training, plus underpinning electrical theory and the ability to gather workplace evidence. The assessment centre confirms whether the assessment can be entered.",
      },
      {
        routeKey: "route_domestic_ewa",
        sourceKeys: ["tesp_ewa_domestic", "tesp_ewa_criteria"],
        label: "Experienced Worker Assessment — domestic",
        summary:
          "This route typically involves at least three years of practising experience in domestic installation work, not counting time spent in training, plus underpinning theory and the ability to gather workplace evidence. The assessment centre confirms whether the assessment can be entered.",
      },
      {
        routeKey: "route_college_workplace_bridge",
        sourceKeys: ["ncs_electrician", "skills_england_st0152"],
        label: "College study alongside workplace experience",
        summary:
          "This route typically involves classroom learning combined with real electrical work experience; entry requirements vary between providers and employers.",
      },
      {
        routeKey: "route_scotland_electrotechnical_verification",
        verificationNote:
          "The specific criteria for this route are not set out in the sources this overview relies on, so they need separate verification.",
        label: "Scotland — separate verification route",
        summary:
          "Scotland has its own arrangements, so this route is treated separately rather than assuming criteria from another nation.",
      },
    ],
    appeal: [
      "Practical problem-solving with a clear result at the end of a job.",
      "Varied sites and jobs rather than the same desk every day.",
      "Recognised competence that can lead to self-employment or supervision.",
      "Growing overlap with lower-carbon work such as solar and EV charging.",
    ],
    challenges: [
      "Work can involve height, cramped spaces and unfinished buildings.",
      "Hours can extend beyond a standard week, and you may be on call.",
      "You carry safety responsibility for work other people rely on.",
      "Recognised competence takes time to evidence, whichever route you take.",
    ],
    sources: [
      {
        sourceKey: "ncs_electrician",
        label: "National Careers Service — Electrician job profile",
        url: "https://nationalcareers.service.gov.uk/job-profiles/electrician",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "jib_ecs_scheme",
        label: "JIB — Electrotechnical Certification Scheme handbook",
        url: "https://www.jib.org.uk/handbook/electrotechnical-certification-scheme/handbook-2026-section-10-electrotechnical-certification-scheme/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "skills_england_st0152",
        label: "Skills England — Installation and maintenance electrician apprenticeship (ST0152)",
        url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st0152?view=standard",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "skills_england_st1017",
        label: "Skills England — Domestic electrician apprenticeship (ST1017)",
        url: "https://skillsengland.education.gov.uk/apprenticeships/st1017-v1-1?view=standard",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "tesp_ewa_criteria",
        label: "TESP Experienced Worker Assessment — Assessment criteria",
        url: "https://www.electrical-ewa.org.uk/are-you-eligible/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "tesp_ewa_installation",
        label: "TESP Experienced Worker Assessment — Installation electrician",
        url: "https://www.electrical-ewa.org.uk/installation-electrician/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "tesp_ewa_domestic",
        label: "TESP Experienced Worker Assessment — Domestic electrician",
        url: "https://www.electrical-ewa.org.uk/domestic-electrician/",
        checkedAt: CHECKED_AT,
      },
    ],
  },
  {
    occupation: {
      occupationId: "2b3c4d5e-6f70-4b8c-9d0e-1f2a3b4c5d03",
      occupationKey: "solicitor_england_wales",
    },
    displayTitle: "Solicitor of England and Wales",
    summary:
      "Solicitors advise clients on the law, prepare legal documents and represent clients' interests, under regulation by the Solicitors Regulation Authority.",
    salary: { starterGbp: 30000, experiencedGbp: 80000, sourceKey: "ncs_solicitor" },
    workPattern: {
      typicalHours: "37 to 50 hours a week",
      patternSummary: "You may need to work on call at short notice.",
      sourceKey: "ncs_solicitor",
    },
    marketContextSummary:
      "The work can be based in private practice or in-house, and spans very different legal specialisms. Competition and the number of openings vary by specialism and employer, so no single national demand label would be honest.",
    marketContextSourceKey: "ncs_solicitor",
    dayToDay: [
      "Taking instructions from clients and advising them on their position.",
      "Researching law and drafting documents, contracts or correspondence.",
      "Negotiating on a client's behalf and progressing matters to a conclusion.",
      "Managing deadlines and case records across several matters at once.",
    ],
    routeDisplays: [
      {
        routeKey: "route_sqe_standard",
        sourceKeys: ["sra_sqe", "sra_qualifying_work_experience"],
        label: "Degree or equivalent plus the SQE",
        summary:
          "This route typically involves a degree or equivalent, passing SQE1 and SQE2, two years of full-time equivalent qualifying work experience, and a suitability assessment.",
      },
      {
        routeKey: "route_solicitor_apprenticeship_non_graduate",
        sourceKeys: ["sra_solicitor_apprenticeships", "sra_sqe"],
        label: "Solicitor apprenticeship without a degree first",
        summary:
          "This route typically involves being employed from a non-graduate starting point while working towards the SQE assessments.",
      },
      {
        routeKey: "route_solicitor_apprenticeship_graduate",
        sourceKeys: ["sra_solicitor_apprenticeships", "sra_sqe"],
        label: "Solicitor apprenticeship after a degree",
        summary:
          "This route typically involves employment combined with the SQE assessments from a graduate starting point.",
      },
      {
        routeKey: "route_lpc_transitional",
        sourceKeys: ["sra_pathways_to_qualification"],
        label: "Transitional route through the previous qualification",
        summary:
          "Transitional arrangements allow a defined group of people to qualify through the earlier route; suitability still applies.",
      },
    ],
    appeal: [
      "Detailed analytical work with real consequences for clients.",
      "Many specialisms to move between, from property to criminal to commercial law.",
      "Clear professional progression once qualified.",
      "More than one recognised way in, including employed apprenticeship routes.",
    ],
    challenges: [
      "Long hours can occur, and short-notice work is possible.",
      "Deadlines and client expectations create sustained pressure.",
      "The law keeps changing, so learning does not stop at qualification.",
      "Qualifying requires assessments, work experience and a regulator's suitability decision.",
    ],
    sources: [
      {
        sourceKey: "ncs_solicitor",
        label: "National Careers Service — Solicitor job profile",
        url: "https://nationalcareers.service.gov.uk/job-profiles/solicitor",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "sra_sqe",
        label: "Solicitors Regulation Authority — Solicitors Qualifying Examination",
        url: "https://www.sra.org.uk/become-solicitor/sqe/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "sra_qualifying_work_experience",
        label: "Solicitors Regulation Authority — Qualifying work experience",
        url: "https://www.sra.org.uk/become-solicitor/sqe/qualifying-work-experience-candidates/qualifying-work-experience-employers",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "sra_solicitor_apprenticeships",
        label: "Solicitors Regulation Authority — Solicitor apprenticeships",
        url: "https://rules.sra.org.uk/become-solicitor/sqe/solicitor-apprenticeships/",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "sra_pathways_to_qualification",
        label: "Solicitors Regulation Authority — Pathways to qualification",
        url: "https://www.sra.org.uk/become-solicitor/admission/pathways-qualification/",
        checkedAt: CHECKED_AT,
      },
    ],
  },
  {
    occupation: {
      occupationId: "3c4d5e6f-7081-4c9d-8e0f-2a3b4c5d6e04",
      occupationKey: "photographer",
    },
    displayTitle: "Photographer",
    summary:
      "Photographers plan and take images for clients or publication, and usually build a portfolio of work rather than a single required qualification.",
    salary: { starterGbp: 17000, experiencedGbp: 45000, sourceKey: "ncs_photographer" },
    workPattern: {
      typicalHours: "39 to 41 variable hours a week",
      patternSummary:
        "You could work evenings, weekends and bank holidays, depending on what customers need.",
      sourceKey: "ncs_photographer",
    },
    marketContextSummary:
      "The National Careers Service describes photography as very competitive, and freelance work is common. That is honest context about how the work is usually obtained, not a discouragement.",
    marketContextSourceKey: "ncs_photographer",
    dayToDay: [
      "Planning shoots, including location, lighting and what the client needs.",
      "Taking images and adjusting technique as conditions change.",
      "Editing and selecting images, then delivering them to a brief.",
      "Looking after equipment, and often quoting, invoicing and finding new work.",
    ],
    routeDisplays: [
      {
        routeKey: "route_portfolio_experience",
        sourceKeys: ["ncs_photographer"],
        label: "Building a portfolio through experience",
        summary:
          "One route into the work: developing a body of work that demonstrates what you can produce, since no single qualification is required.",
      },
      {
        routeKey: "route_photographer_apprenticeship",
        sourceKeys: ["skills_england_st1388", "ncs_photographer"],
        label: "Photographer apprenticeship",
        summary:
          "This route typically involves employed training with a portfolio-based end-point assessment gateway.",
      },
      {
        routeKey: "route_higher_education_photography",
        sourceKeys: ["ncs_photographer"],
        label: "Photography course in higher education",
        summary:
          "This route typically involves formal study that develops technique alongside a body of work; no single qualification is required for this career.",
      },
      {
        routeKey: "route_assistant_toward_photographer",
        sourceKeys: ["ncs_photographer"],
        label: "Starting as a photographer's assistant",
        summary:
          "This route typically involves supporting an established photographer while building your own experience.",
      },
      {
        routeKey: "route_self_employed_photographer",
        sourceKeys: ["ncs_photographer"],
        label: "Working for yourself",
        summary:
          "This route typically involves running your own photography work, including finding clients and managing the business side.",
      },
    ],
    appeal: [
      "Creative work with a visible result you can show people.",
      "Room to specialise, from weddings and portraits to press work.",
      "Freelance work can bring real control over what you take on.",
      "Progress rests largely on the work you can demonstrate.",
    ],
    challenges: [
      "The field is described as very competitive.",
      "Hours are variable and often fall on evenings, weekends and bank holidays.",
      "Equipment access matters, and freelance income can be uneven.",
      "Self-employment means marketing, quoting and admin alongside the photography.",
    ],
    sources: [
      {
        sourceKey: "ncs_photographer",
        label: "National Careers Service — Photographer job profile",
        url: "https://nationalcareers.service.gov.uk/job-profiles/photographer",
        checkedAt: CHECKED_AT,
      },
      {
        sourceKey: "skills_england_st1388",
        label: "Skills England — Photographer apprenticeship (ST1388)",
        url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st1388",
        checkedAt: CHECKED_AT,
      },
    ],
  },
]);
