import type {
  InternalEvidenceGrade,
  ParticipantEvidenceClassification,
} from "../../../domain/contracts";

/**
 * Fixed evidence SOURCE IDENTITIES for the four architecture-test Career Packs.
 *
 * Identity only. This module holds no network call, no ingestion, no live
 * retrieval, no participant-facing copy and no source document body. The stable
 * UUIDs and record keys below are authored constants: they are never derived from
 * runtime, environment or network state.
 *
 * Human audit provenance (URLs, retrieval date, paraphrased claim mapping) lives
 * in `docs/research/increment-11-authoritative-sources.md`, NOT in runtime truth.
 */

/** Stable internal source identities. */
export const ARCHITECTURE_TEST_SOURCE_IDS = Object.freeze({
  nmc: "0a5b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d",
  skills_england: "1b6c2d3e-4f50-4b6c-8d7e-8f9a0b1c2d3e",
  sra: "2c7d3e4f-5061-4c7d-8e8f-9a0b1c2d3e4f",
  national_careers_service: "3d8e4f50-6172-4d8e-8f90-ab1c2d3e4f50",
  tesp_ewa: "4e9f5061-7283-4e9f-90a1-bc2d3e4f5061",
  jib_ecs: "5fa06172-8394-4fa0-91b2-cd3e4f506172",
} as const);

export type ArchitectureTestSourceName = keyof typeof ARCHITECTURE_TEST_SOURCE_IDS;

/** Clear Routes-owned stable source keys, aligned with the identities above. */
export const ARCHITECTURE_TEST_SOURCE_KEYS = Object.freeze({
  nmc: "source.nmc",
  skills_england: "source.skills_england",
  sra: "source.sra",
  national_careers_service: "source.national_careers_service",
  tesp_ewa: "source.tesp_ewa",
  jib_ecs: "source.jib_ecs",
} as const);

/**
 * Evidence source definitions in the exact shape the Evidence Registry accepts.
 * Deliberately minimal: identity plus stable key, nothing else.
 */
export const ARCHITECTURE_TEST_SOURCES = Object.freeze(
  (Object.keys(ARCHITECTURE_TEST_SOURCE_IDS) as ArchitectureTestSourceName[]).map((name) =>
    Object.freeze({
      sourceId: ARCHITECTURE_TEST_SOURCE_IDS[name],
      sourceKey: ARCHITECTURE_TEST_SOURCE_KEYS[name],
    }),
  ),
);

/**
 * Stable machine record keys for the exact cited pages / standards.
 *
 * These are stable internal paths, never participant copy and never live URLs.
 */
export const ARCHITECTURE_TEST_RECORD_KEYS = Object.freeze({
  nmc_becoming_a_nurse: "nmc/education/becoming-a-nurse",
  nmc_approved_programmes: "nmc/education/approved-programmes",
  nmc_health_and_character: "nmc/registration/joining-the-register/health-and-character",
  nmc_joining_the_register: "nmc/registration/joining-the-register",
  skills_england_st0781: "skills-england/apprenticeship-standards/st0781",
  skills_england_st0152: "skills-england/apprenticeship-standards/st0152",
  skills_england_st1017: "skills-england/apprenticeship-standards/st1017",
  skills_england_st1388: "skills-england/apprenticeship-standards/st1388",
  sra_sqe: "sra/become-solicitor/sqe",
  sra_sqe_qa: "sra/become-solicitor/sqe/qa",
  sra_degree_equivalent: "sra/become-solicitor/sqe/check-validate-qualification/degree-equivalent",
  sra_qualifying_work_experience: "sra/become-solicitor/sqe/qualifying-work-experience",
  sra_solicitor_apprenticeships: "sra/become-solicitor/sqe/solicitor-apprenticeships",
  sra_pathways_to_qualification: "sra/become-solicitor/admission/pathways-qualification",
  ncs_electrician: "national-careers-service/job-profiles/electrician",
  ncs_electrician_entry_requirements:
    "national-careers-service/job-profiles/electrician#entry-requirements",
  ncs_photographer: "national-careers-service/job-profiles/photographer",

  tesp_ewa_eligibility: "tesp-ewa/are-you-eligible",
  tesp_ewa_installation_electrician: "tesp-ewa/installation-electrician",
  tesp_ewa_domestic_electrician: "tesp-ewa/domestic-electrician",
  jib_ecs_gold_card: "jib/handbook-2026/section-10-electrotechnical-certification-scheme",
} as const);

export type ArchitectureTestRecordName = keyof typeof ARCHITECTURE_TEST_RECORD_KEYS;

/**
 * Build a Career Pack evidence reference.
 *
 * `grade` and `participantClassification` are ALWAYS explicit: an architecture-test
 * pack never attaches evidence of undeclared strength. No external
 * `recordContentHash` is invented and no `recordVersion` is pinned here, because
 * these external records expose no stable semantic version we could honestly pin.
 */
export function evidenceReference(
  source: ArchitectureTestSourceName,
  record: ArchitectureTestRecordName,
  grade: InternalEvidenceGrade,
  participantClassification: ParticipantEvidenceClassification,
): {
  readonly sourceId: string;
  readonly sourceRecordKey: string;
  readonly grade: InternalEvidenceGrade;
  readonly participantClassification: ParticipantEvidenceClassification;
} {
  return {
    sourceId: ARCHITECTURE_TEST_SOURCE_IDS[source],
    sourceRecordKey: ARCHITECTURE_TEST_RECORD_KEYS[record],
    grade,
    participantClassification,
  };
}
