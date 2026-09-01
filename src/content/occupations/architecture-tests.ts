import {
  parseCanonicalOccupationUniverse,
  type OccupationUniverse,
} from "../../domain/occupation-universe";

/**
 * ARCHITECTURE-TEST occupation content.
 *
 * These four records exist to prove that real content can consume the canonical
 * occupation universe and its resolver. They are deliberately NOT a UK
 * occupation catalogue, NOT published content and NOT participant UI content.
 * Broad coverage is a later increment.
 *
 * They correspond exactly to the four Increment 11 architecture-test Career
 * Packs, and their `occupationKey` values match those packs verbatim so binding
 * can be proven without touching Career Pack content.
 *
 * Search terms are conservative and defensible only. No broad alias is invented
 * that would become unsafe once the catalogue grows; several term categories are
 * legitimately empty.
 *
 * Deliberately ABSENT, and not to be reintroduced without a safe ambiguity or
 * ownership model:
 * - bare `Nurse` — spans registered, veterinary, dental and nursery-related
 *   occupations in a future UK catalogue;
 * - bare `Solicitor` — jurisdictionally ambiguous while Scotland and Northern
 *   Ireland occupations are absent from this set;
 * - `Content Creator Photographer` — not an established, defensible UK title.
 *   Emerging-title support is proven through test-only fixtures instead.
 */
export const ARCHITECTURE_TEST_OCCUPATIONS: OccupationUniverse = parseCanonicalOccupationUniverse([
  {
    occupationId: "0c1f1b64-9d5a-4a4c-9a0f-1f0a5d3c9b01",
    occupationKey: "registered_nurse",
    canonicalTitle: "Registered Nurse",
    specialisms: [
      "Adult Nurse",
      "Children's Nurse",
      "Mental Health Nurse",
      "Learning Disability Nurse",
    ],
    aliases: [],
    abbreviations: ["RN"],
    colloquialTitles: [],
    emergingTitles: [],
  },
  {
    occupationId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02",
    occupationKey: "electrician",
    canonicalTitle: "Electrician",
    specialisms: ["Domestic Electrician", "Installation Electrician", "Maintenance Electrician"],
    aliases: [],
    abbreviations: [],
    colloquialTitles: ["Sparky"],
    emergingTitles: [],
  },
  {
    occupationId: "2b3c4d5e-6f70-4b8c-9d0e-1f2a3b4c5d03",
    occupationKey: "solicitor_england_wales",
    canonicalTitle: "Solicitor of England and Wales",
    specialisms: [],
    aliases: [],
    abbreviations: [],
    colloquialTitles: [],
    emergingTitles: [],
  },
  {
    occupationId: "3c4d5e6f-7081-4c9d-8e0f-2a3b4c5d6e04",
    occupationKey: "photographer",
    canonicalTitle: "Photographer",
    specialisms: ["Wedding Photographer", "Portrait Photographer", "Press Photographer"],
    aliases: [],
    abbreviations: [],
    colloquialTitles: [],
    emergingTitles: [],
  },
]);
