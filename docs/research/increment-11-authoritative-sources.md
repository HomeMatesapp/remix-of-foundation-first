# Increment 11 — Authoritative research provenance (architecture-test careers)

Human audit record for the four architecture-test Career Packs. Runtime truth
carries stable identities only; this document carries the human-readable
provenance behind those identities.

- Research basis captured: **26 August 2026**
- Scope: architecture-test content only. Nothing here is published participant
  content, and nothing here is a career catalogue.
- Evidence strength convention used throughout:
  - **A / `confirmed_requirement`** — regulator, awarding or standards body
    stating a requirement in its own authority.
  - **B / `provider_dependent`** — the source itself says entry criteria vary by
    employer or provider.
  - **B / `general_guidance`** — general national careers guidance describing
    typical practice rather than a rule.

## Source identities

| Source key | Internal source id | Body |
| --- | --- | --- |
| `source.nmc` | `0a5b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d` | Nursing and Midwifery Council |
| `source.skills_england` | `1b6c2d3e-4f50-4b6c-8d7e-8f9a0b1c2d3e` | Skills England apprenticeship standards |
| `source.sra` | `2c7d3e4f-5061-4c7d-8e8f-9a0b1c2d3e4f` | Solicitors Regulation Authority |
| `source.national_careers_service` | `3d8e4f50-6172-4d8e-8f90-ab1c2d3e4f50` | National Careers Service |
| `source.tesp_ewa` | `4e9f5061-7283-4e9f-90a1-bc2d3e4f5061` | TESP Experienced Worker Assessment |
| `source.jib_ecs` | `5fa06172-8394-4fa0-91b2-cd3e4f506172` | JIB / Electrotechnical Certification Scheme |

## Registered Nurse (UK / NMC)

| Record key | Authoritative URL | Grade | Classification | Claim relied upon (paraphrased) |
| --- | --- | --- | --- | --- |
| `nmc/education/becoming-a-nurse` | https://www.nmc.org.uk/education/becoming-a-nurse-midwife-nursing-associate/becoming-a-nurse/ | A | confirmed_requirement | Registration follows completion of an NMC-approved pre-registration programme combining theory and supervised clinical practice. |
| `nmc/education/approved-programmes` | https://www.nmc.org.uk/education/approved-programmes/ | A | confirmed_requirement | Only NMC-approved programmes lead to registration; entry to a specific programme is set by the approved education institution. |
| `nmc/registration/joining-the-register/health-and-character` | https://www.nmc.org.uk/registration/joining-the-register/health-and-character/ | A | confirmed_requirement | Health and character declarations are assessed by the regulator before registration. |
| `nmc/registration/joining-the-register` | https://www.nmc.org.uk/registration/joining-the-register/ | A | confirmed_requirement | Applicants qualified outside the UK are assessed against NMC standards through a defined verification process. |
| `skills-england/apprenticeship-standards/st0781` | https://skillsengland.education.gov.uk/apprenticeship-standards/st0781 | A | confirmed_requirement | The registered nurse degree apprenticeship requires an employer to employ and support the apprentice. |

Modelling consequences: provider entry that has not been checked resolves to
`verification_required`; employer support that is not confirmed resolves to
`verification_required`; local access to an approved programme is a declared
local requirement with an unresolved check, never route impossibility.

## Electrician (UK, nation-sensitive)

| Record key | Authoritative URL | Grade | Classification | Claim relied upon (paraphrased) |
| --- | --- | --- | --- | --- |
| `jib/handbook-2026/section-10-electrotechnical-certification-scheme` | https://www.jib.org.uk/handbook/electrotechnical-certification-scheme/handbook-2026-section-10-electrotechnical-certification-scheme/ | A | confirmed_requirement | Recognised occupational competence for an electrician is evidenced through the industry certification scheme. |
| `tesp-ewa/are-you-eligible` | https://www.electrical-ewa.org.uk/are-you-eligible/ | A | confirmed_requirement | The Experienced Worker Assessment requires underpinning electrical theory and the ability to gather workplace evidence; the assessment centre confirms eligibility. |
| `tesp-ewa/installation-electrician` | https://www.electrical-ewa.org.uk/installation-electrician/ | A | confirmed_requirement | The Installation/Maintenance Experienced Worker Assessment requires **at least 5 years** practising experience in that scope. Time spent in training does not count towards that period, and assessment-centre eligibility verification remains relevant where documented. |
| `tesp-ewa/domestic-electrician` | https://www.electrical-ewa.org.uk/domestic-electrician/ | A | confirmed_requirement | The Domestic Experienced Worker Assessment requires **at least 3 years** practising experience in domestic installation work. Time spent in training does not count towards that period, and assessment-centre eligibility verification remains relevant where documented. |
| `skills-england/apprenticeship-standards/st0152` | https://skillsengland.education.gov.uk/apprenticeship-standards/st0152?view=standard | A | confirmed_requirement | The **installation and maintenance electrician** apprenticeship (ST0152) is an employed training route. This record covers installation and maintenance only. |
| `skills-england/apprenticeship-standards/st1017` | https://skillsengland.education.gov.uk/apprenticeships/st1017-v1-1?view=standard | A | confirmed_requirement | The **domestic electrician** apprenticeship (ST1017) is an employed Level 3 training route for domestic electrical work. |
| `national-careers-service/job-profiles/electrician` | https://nationalcareers.service.gov.uk/job-profiles/electrician | B | general_guidance | Typical working patterns include work at height and in confined spaces. |
| `national-careers-service/job-profiles/electrician#entry-requirements` | https://nationalcareers.service.gov.uk/job-profiles/electrician | B | provider_dependent | Entry requirements vary between employers and providers. |

Modelling consequences: the assessment routes are declared **unavailable** where
the cited scheme evidence does not extend rather than applying its criteria to a
different nation; Scotland is given its own declared route with an unresolved
verification check. The 5-year and 3-year thresholds are authored as milestone
conditions, so a participant below the threshold sees an outstanding condition
rather than a closed career.

## Solicitor of England and Wales (SRA)

| Record key | Authoritative URL | Grade | Classification | Claim relied upon (paraphrased) |
| --- | --- | --- | --- | --- |
| `sra/become-solicitor/sqe` | https://www.sra.org.uk/become-solicitor/sqe/ | A | confirmed_requirement | Admission requires a degree or equivalent, SQE1 and SQE2, qualifying work experience and a suitability assessment. |
| `sra/become-solicitor/sqe/qa` | https://www.sra.org.uk/become-solicitor/sqe/qa/ | A | confirmed_requirement | SQE assessments may be taken in either order relative to work experience; SQE2 must be passed for admission. |
| `sra/become-solicitor/sqe/check-validate-qualification/degree-equivalent` | https://www.sra.org.uk/become-solicitor/sqe/check-validate-qualification/degree-equivalent/ | A | confirmed_requirement | Whether a qualification is equivalent to a degree is a decision the regulator makes. |
| `sra/become-solicitor/sqe/qualifying-work-experience` | https://www.sra.org.uk/become-solicitor/sqe/qualifying-work-experience-candidates/qualifying-work-experience-employers | A | confirmed_requirement | Two years of full-time equivalent qualifying work experience is required. |
| `sra/become-solicitor/sqe/solicitor-apprenticeships` | https://rules.sra.org.uk/become-solicitor/sqe/solicitor-apprenticeships/ | A | confirmed_requirement | Solicitor apprenticeships combine employment with the SQE assessments; non-graduate and graduate starting points exist. |
| `sra/become-solicitor/admission/pathways-qualification` | https://www.sra.org.uk/become-solicitor/admission/pathways-qualification/ | A | confirmed_requirement | Transitional arrangements allow a defined cohort to qualify through the previous route; suitability applies to all pathways. |

Modelling consequences: SQE1, SQE2 and qualifying work experience are declared
`contextual` milestones so an early-stage participant sees conditions rather than
a closed route; degree equivalence is `verification_required`; suitability is a
global unresolved matter.

## Photographer (UK, unregulated)

| Record key | Authoritative URL | Grade | Classification | Claim relied upon (paraphrased) |
| --- | --- | --- | --- | --- |
| `national-careers-service/job-profiles/photographer` | https://nationalcareers.service.gov.uk/job-profiles/photographer | B | general_guidance | There is no single required qualification; a portfolio, equipment access and irregular hours characterise the work, and many photographers are self-employed. |
| `skills-england/apprenticeship-standards/st1388` | https://skillsengland.education.gov.uk/apprenticeship-standards/st1388 | A | confirmed_requirement | The photographer apprenticeship includes a portfolio-based end-point assessment gateway. |

Modelling consequences: no eligibility requirement exists anywhere in the pack;
portfolio, equipment and working patterns are practical fit, barriers and
ranking; guidance-grade evidence keeps those states at `verification_required`.


## Deliberate non-decisions

- No occupation universe, SOC mapping, salary, demand or vacancy data.
- No provider directory, course listing or local availability.
- No publication, review or approval state; these packs are not published.
- No participant-facing copy: every authored string is a stable machine key.
