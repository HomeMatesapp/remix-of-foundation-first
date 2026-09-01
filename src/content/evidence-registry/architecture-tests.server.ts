import { createHash } from "node:crypto";

import type {
  InternalEvidenceGrade,
  ParticipantEvidenceClassification,
} from "../../domain/contracts";
import {
  EVIDENCE_REGISTRY_SCHEMA_VERSION,
  parseCanonicalEvidenceRegistry,
  type EvidenceRegistry,
} from "../../domain/evidence-registry";
import {
  ARCHITECTURE_TEST_RECORD_KEYS,
  ARCHITECTURE_TEST_SOURCES,
  ARCHITECTURE_TEST_SOURCE_IDS,
  type ArchitectureTestRecordName,
  type ArchitectureTestSourceName,
} from "../career-packs/architecture-tests/sources";

/**
 * Increment 16 — the REVIEWED RUNTIME Evidence Registry for the four
 * architecture-test careers.
 *
 * This is deliberately NOT the Increment 11 test fixture. It is authored here,
 * independently of the Career Packs, from the human audit record in
 * `docs/research/increment-11-authoritative-sources.md` (research basis
 * 26 August 2026). Each revision declares its own grade and participant
 * classification. If a Career Pack ever declared a different strength for the
 * same source record, Evidence Context creation fails closed and no result is
 * produced — the registry never bends to the pack, and the pack never promotes
 * itself here.
 *
 * Hard boundaries:
 * - no live retrieval, no ingestion, no network call, no source document body;
 * - `recordContentHash` is a deterministic hash of the REVIEWED DESCRIPTOR below
 *   (identity, declared strength, reviewed claim, reviewed instant). It never
 *   pretends to be the hash of an external page body, and it changes if and only
 *   if the reviewed descriptor changes;
 * - participant-facing source labels and URLs live OUTSIDE the canonical
 *   registry document, because that document is strict and carries identity and
 *   strength only.
 *
 * This module is server-only: it uses `node:crypto` and must never enter a
 * browser bundle.
 */

/** Instant the reviewed basis for every record below was captured. */
export const REVIEWED_EVIDENCE_BASIS_AT = "2026-08-26T00:00:00Z";
export const REVIEWED_EVIDENCE_CHECKED_ON = "2026-08-26";
const REVIEWED_RECORD_VERSION = "1.0.0";

interface ReviewedEvidenceRecord {
  readonly source: ArchitectureTestSourceName;
  readonly record: ArchitectureTestRecordName;
  readonly grade: InternalEvidenceGrade;
  readonly participantClassification: ParticipantEvidenceClassification;
  /** Paraphrased reviewed claim. Internal audit text, never participant copy. */
  readonly reviewedClaim: string;
  /** Participant-facing attribution for this exact record. */
  readonly display: {
    readonly label: string;
    readonly url: string;
    /** Honest statement of what this source does NOT settle, when that applies. */
    readonly limitation?: string;
  };
}

const REVIEWED_RECORDS: readonly ReviewedEvidenceRecord[] = Object.freeze([
  /* ---------------------------------------------------------------- Nursing */
  {
    source: "nmc",
    record: "nmc_becoming_a_nurse",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Registration follows completion of an NMC-approved pre-registration programme combining theory and supervised clinical practice.",
    display: {
      label: "Nursing and Midwifery Council — Becoming a nurse",
      url: "https://www.nmc.org.uk/education/becoming-a-nurse-midwife-nursing-associate/becoming-a-nurse/",
    },
  },
  {
    source: "nmc",
    record: "nmc_approved_programmes",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Only NMC-approved programmes lead to registration; entry to a specific programme is set by the approved education institution.",
    display: {
      label: "Nursing and Midwifery Council — Approved programmes",
      url: "https://www.nmc.org.uk/education/approved-programmes/",
      limitation:
        "It does not set the entry criteria of any particular university, so it cannot tell you whether a specific programme would accept you.",
    },
  },
  {
    source: "nmc",
    record: "nmc_health_and_character",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Health and character declarations are assessed by the regulator before registration.",
    display: {
      label: "Nursing and Midwifery Council — Health and character",
      url: "https://www.nmc.org.uk/registration/joining-the-register/health-and-character/",
      limitation:
        "The outcome of any declaration is a decision for the regulator alone, and nothing here predicts it.",
    },
  },
  {
    source: "nmc",
    record: "nmc_joining_the_register",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Applicants qualified outside the UK are assessed against NMC standards through a defined verification process.",
    display: {
      label: "Nursing and Midwifery Council — Joining the register",
      url: "https://www.nmc.org.uk/registration/joining-the-register/",
    },
  },
  {
    source: "skills_england",
    record: "skills_england_st0781",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The registered nurse degree apprenticeship requires an employer to employ and support the apprentice.",
    display: {
      label: "Skills England — Registered nurse degree apprenticeship (ST0781)",
      url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st0781",
      limitation:
        "It describes the standard, not whether any employer near you is currently taking apprentices on.",
    },
  },

  /* ------------------------------------------------------------ Electrician */
  {
    source: "jib_ecs",
    record: "jib_ecs_gold_card",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Recognised occupational competence for an electrician is evidenced through the industry certification scheme.",
    display: {
      label: "JIB — Electrotechnical Certification Scheme handbook (2026, section 10)",
      url: "https://www.jib.org.uk/handbook/electrotechnical-certification-scheme/handbook-2026-section-10-electrotechnical-certification-scheme/",
    },
  },
  {
    source: "tesp_ewa",
    record: "tesp_ewa_eligibility",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The Experienced Worker Assessment requires underpinning electrical theory and the ability to gather workplace evidence; the assessment centre confirms eligibility.",
    display: {
      label: "Experienced Worker Assessment — Are you eligible?",
      url: "https://www.electrical-ewa.org.uk/are-you-eligible/",
      limitation:
        "Whether you are eligible is confirmed by an assessment centre, so this cannot be settled here.",
    },
  },
  {
    source: "tesp_ewa",
    record: "tesp_ewa_installation_electrician",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The Installation/Maintenance Experienced Worker Assessment requires at least five years practising experience in that scope, and time spent in training does not count towards that period.",
    display: {
      label: "Experienced Worker Assessment — Installation electrician",
      url: "https://www.electrical-ewa.org.uk/installation-electrician/",
    },
  },
  {
    source: "tesp_ewa",
    record: "tesp_ewa_domestic_electrician",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The Domestic Experienced Worker Assessment requires at least three years practising experience in domestic installation work, and time spent in training does not count towards that period.",
    display: {
      label: "Experienced Worker Assessment — Domestic electrician",
      url: "https://www.electrical-ewa.org.uk/domestic-electrician/",
    },
  },
  {
    source: "skills_england",
    record: "skills_england_st0152",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The installation and maintenance electrician apprenticeship (ST0152) is an employed training route, covering installation and maintenance only.",
    display: {
      label: "Skills England — Installation and maintenance electrician (ST0152)",
      url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st0152?view=standard",
    },
  },
  {
    source: "skills_england",
    record: "skills_england_st1017",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The domestic electrician apprenticeship (ST1017) is an employed Level 3 training route for domestic electrical work.",
    display: {
      label: "Skills England — Domestic electrician (ST1017)",
      url: "https://skillsengland.education.gov.uk/apprenticeships/st1017-v1-1?view=standard",
    },
  },
  {
    source: "national_careers_service",
    record: "ncs_electrician",
    grade: "B",
    participantClassification: "general_guidance",
    reviewedClaim: "Typical working patterns include work at height and in confined spaces.",
    display: {
      label: "National Careers Service — Electrician job profile",
      url: "https://nationalcareers.service.gov.uk/job-profiles/electrician",
      limitation: "This is general national guidance about typical practice, not a rule.",
    },
  },
  {
    source: "national_careers_service",
    record: "ncs_electrician_entry_requirements",
    grade: "B",
    participantClassification: "provider_dependent",
    reviewedClaim: "Entry requirements vary between employers and providers.",
    display: {
      label: "National Careers Service — Electrician entry requirements",
      url: "https://nationalcareers.service.gov.uk/job-profiles/electrician",
      limitation:
        "It says entry requirements vary by employer and provider, so no single answer applies everywhere.",
    },
  },

  /* -------------------------------------------------------------- Solicitor */
  {
    source: "sra",
    record: "sra_sqe",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Admission requires a degree or equivalent, SQE1 and SQE2, qualifying work experience and a suitability assessment.",
    display: {
      label: "Solicitors Regulation Authority — Solicitors Qualifying Examination",
      url: "https://www.sra.org.uk/become-solicitor/sqe/",
    },
  },
  {
    source: "sra",
    record: "sra_sqe_qa",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "SQE assessments may be taken in either order relative to work experience; SQE2 must be passed for admission.",
    display: {
      label: "Solicitors Regulation Authority — SQE questions and answers",
      url: "https://www.sra.org.uk/become-solicitor/sqe/qa/",
    },
  },
  {
    source: "sra",
    record: "sra_degree_equivalent",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Whether a qualification is equivalent to a degree is a decision the regulator makes.",
    display: {
      label: "Solicitors Regulation Authority — Degree equivalent qualifications",
      url: "https://www.sra.org.uk/become-solicitor/sqe/check-validate-qualification/degree-equivalent/",
      limitation:
        "Equivalence is decided by the regulator on the facts of your own qualification, so it cannot be settled here.",
    },
  },
  {
    source: "sra",
    record: "sra_qualifying_work_experience",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim: "Two years of full-time equivalent qualifying work experience is required.",
    display: {
      label: "Solicitors Regulation Authority — Qualifying work experience",
      url: "https://www.sra.org.uk/become-solicitor/sqe/qualifying-work-experience-candidates/qualifying-work-experience-employers",
    },
  },
  {
    source: "sra",
    record: "sra_solicitor_apprenticeships",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Solicitor apprenticeships combine employment with the SQE assessments; non-graduate and graduate starting points exist.",
    display: {
      label: "Solicitors Regulation Authority — Solicitor apprenticeships",
      url: "https://rules.sra.org.uk/become-solicitor/sqe/solicitor-apprenticeships/",
    },
  },
  {
    source: "sra",
    record: "sra_pathways_to_qualification",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "Transitional arrangements allow a defined cohort to qualify through the previous route; suitability applies to all pathways.",
    display: {
      label: "Solicitors Regulation Authority — Pathways to qualification",
      url: "https://www.sra.org.uk/become-solicitor/admission/pathways-qualification/",
    },
  },

  /* ----------------------------------------------------------- Photographer */
  {
    source: "national_careers_service",
    record: "ncs_photographer",
    grade: "B",
    participantClassification: "general_guidance",
    reviewedClaim:
      "There is no single required qualification; a portfolio, equipment access and irregular hours characterise the work, and many photographers are self-employed.",
    display: {
      label: "National Careers Service — Photographer job profile",
      url: "https://nationalcareers.service.gov.uk/job-profiles/photographer",
      limitation: "This is general national guidance about typical practice, not a rule.",
    },
  },
  {
    source: "skills_england",
    record: "skills_england_st1388",
    grade: "A",
    participantClassification: "confirmed_requirement",
    reviewedClaim:
      "The photographer apprenticeship includes a portfolio-based end-point assessment gateway.",
    display: {
      label: "Skills England — Photographer apprenticeship (ST1388)",
      url: "https://skillsengland.education.gov.uk/apprenticeship-standards/st1388",
      limitation:
        "It describes the standard, not whether any employer near you is currently taking apprentices on.",
    },
  },
]);

/**
 * Deterministic content hash of the REVIEWED DESCRIPTOR of one revision.
 *
 * Field order is fixed here, so the hash is stable across runs and machines.
 */
function reviewedRecordContentHash(entry: ReviewedEvidenceRecord): string {
  const descriptor = [
    ARCHITECTURE_TEST_SOURCE_IDS[entry.source],
    ARCHITECTURE_TEST_RECORD_KEYS[entry.record],
    REVIEWED_RECORD_VERSION,
    entry.grade,
    entry.participantClassification,
    entry.reviewedClaim,
    REVIEWED_EVIDENCE_BASIS_AT,
  ].join("\u0000");
  return createHash("sha256").update(`clear-routes-reviewed-evidence:${descriptor}`).digest("hex");
}

/** Participant-facing attribution for one exact reviewed source record. */
export interface ReviewedEvidenceDisplay {
  readonly sourceId: string;
  readonly sourceRecordKey: string;
  readonly label: string;
  readonly url: string;
  readonly checkedOn: string;
  readonly limitation?: string;
}

export const ARCHITECTURE_TEST_EVIDENCE_DISPLAY: readonly ReviewedEvidenceDisplay[] = Object.freeze(
  REVIEWED_RECORDS.map((entry) =>
    Object.freeze({
      sourceId: ARCHITECTURE_TEST_SOURCE_IDS[entry.source],
      sourceRecordKey: ARCHITECTURE_TEST_RECORD_KEYS[entry.record],
      label: entry.display.label,
      url: entry.display.url,
      checkedOn: REVIEWED_EVIDENCE_CHECKED_ON,
      ...(entry.display.limitation ? { limitation: entry.display.limitation } : {}),
    }),
  ),
);

/**
 * The canonical reviewed registry document.
 *
 * Built fresh on each call and validated by the closed Increment 7 parser, so a
 * defect in this authored content can never reach an evaluation.
 */
export function architectureTestEvidenceRegistry(): EvidenceRegistry {
  return parseCanonicalEvidenceRegistry({
    registryVersion: EVIDENCE_REGISTRY_SCHEMA_VERSION,
    sources: ARCHITECTURE_TEST_SOURCES.map((source) => ({ ...source })),
    records: REVIEWED_RECORDS.map((entry) => ({
      sourceId: ARCHITECTURE_TEST_SOURCE_IDS[entry.source],
      sourceRecordKey: ARCHITECTURE_TEST_RECORD_KEYS[entry.record],
      recordVersion: REVIEWED_RECORD_VERSION,
      recordContentHash: reviewedRecordContentHash(entry),
      grade: entry.grade,
      participantClassification: entry.participantClassification,
      retrievedAt: REVIEWED_EVIDENCE_BASIS_AT,
    })),
  });
}
