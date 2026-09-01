import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { NORMALISE_TITLE_OPERATIONS } from "../d4-decisions";
import { assessD8UnaccentWrapperProof } from "../d8-unaccent-wrapper-proof";
import { D7_AUTHORED_OBJECTS } from "../d7-relational-authoring";
import {
  CANONICAL_TITLE_OPERATION_ORDER,
  CANONICAL_TITLE_PROHIBITIONS,
  CANONICAL_TITLE_UNICODE_MECHANISM,
  CanonicalTitleWriteError,
  assertOccupationTitleWriteValues,
  buildOccupationTitleWriteValues,
  isCanonicalTitleNormalised,
  normaliseCanonicalTitle,
} from "../d9-canonical-title";
import {
  D9_CURRENT_DEPENDENCY_NODES,
  D9_FORBIDDEN_DATABASE_OBJECTS,
  D9_INTEGRITY_MODEL,
  D9_MIGRATION_FACTS,
  D9_OCCUPATION_AUTHORING_BLOCKER_SUPERSEDED_R1,
  D9_OCCUPATION_SQL_AUTHORED,
  D9_R1_OCCUPATION_AUTHORING_BLOCKER,
  D9_R1_OCCUPATION_FROZEN_BY_ERD,
  D9_R1_RECONCILIATION,
  D9_OWNER_ARCHITECTURE_DECISION,
  D9_RECONCILIATION,
  applyD9DependencyReconciliation,
  assessD9ApplicationNormalisation,
  getD9CurrentNode,
} from "../d9-application-normalisation";

const NORMALISER_SOURCE = readFileSync(
  new URL("../d9-canonical-title.ts", import.meta.url),
  "utf8",
);

/**
 * Executable code only: block comments, line comments and string literals are
 * stripped, so a hostile scan cannot be satisfied or defeated by prose.
 */
const NORMALISER_CODE = NORMALISER_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");

describe("Stage D9 application-computed canonical title normalisation", () => {
  it("keeps the exact frozen operation order and never re-declares it", () => {
    expect([...CANONICAL_TITLE_OPERATION_ORDER]).toEqual([
      "lowercase",
      "remove_punctuation",
      "remove_diacritics",
      "collapse_whitespace",
    ]);
    expect(CANONICAL_TITLE_OPERATION_ORDER).toBe(NORMALISE_TITLE_OPERATIONS);
    expect(D9_OWNER_ARCHITECTURE_DECISION.normalisationBehaviourChanged).toBe(false);
  });

  it("is deterministic and idempotent", () => {
    for (const input of [
      "Registered Nurse",
      "  Senior   Développeur  ",
      "Nurse—Practitioner",
      "H.G.V. Driver",
      "Children's Nurse",
    ]) {
      const once = normaliseCanonicalTitle(input);
      expect(normaliseCanonicalTitle(input)).toBe(once);
      expect(normaliseCanonicalTitle(once)).toBe(once);
      expect(isCanonicalTitleNormalised(once)).toBe(true);
    }
  });

  it("removes Unicode punctuation without ever concatenating adjacent words", () => {
    expect(normaliseCanonicalTitle("Nurse—Practitioner")).toBe("nurse practitioner");
    expect(normaliseCanonicalTitle("Nurse–Practitioner")).toBe("nurse practitioner");
    expect(normaliseCanonicalTitle("Nurse-Practitioner")).toBe("nurse practitioner");
    expect(normaliseCanonicalTitle("Teacher/Assessor")).toBe("teacher assessor");
    expect(normaliseCanonicalTitle("Chef «Pâtissier»")).toBe("chef patissier");
    expect(normaliseCanonicalTitle("Nurse...Practitioner")).toBe("nurse practitioner");
    expect(normaliseCanonicalTitle("Nurse ~~~ Practitioner")).toBe("nurse practitioner");
    expect(normaliseCanonicalTitle("H.G.V. Driver")).toBe("h g v driver");
    expect(normaliseCanonicalTitle("Children's Nurse")).toBe("children s nurse");
  });

  it("removes diacritics through NFD decomposition and combining-mark removal", () => {
    expect(normaliseCanonicalTitle("Café Manager")).toBe("cafe manager");
    expect(normaliseCanonicalTitle("  Senior   Développeur  ")).toBe("senior developpeur");
    // Honest Unicode limit: letters with no canonical decomposition (for
    // example the Latin stroke letter below) are preserved, not guessed at.
    expect(normaliseCanonicalTitle("Ingeniører")).toBe("ingeniører");
    expect(normaliseCanonicalTitle("Zoölogist")).toBe("zoologist");
    // Pre-decomposed input reaches the same canonical identity as composed input.
    expect(normaliseCanonicalTitle("Cafe\u0301 Manager")).toBe("cafe manager");
    expect(NORMALISER_SOURCE).toContain('normalize("NFD")');
  });

  it("collapses every whitespace kind and trims", () => {
    expect(normaliseCanonicalTitle("registered\t\tnurse \n")).toBe("registered nurse");
    expect(normaliseCanonicalTitle("police\u00a0officer")).toBe("police officer");
    expect(normaliseCanonicalTitle("already normalised title")).toBe("already normalised title");
  });

  it("uses no hand-written accent, transliteration or locale-specific mapping", () => {
    expect(CANONICAL_TITLE_UNICODE_MECHANISM.transliterationMap).toBeNull();
    expect(CANONICAL_TITLE_UNICODE_MECHANISM.localeDependent).toBe(false);
    expect(NORMALISER_CODE).not.toMatch(
      /toLocaleLowerCase|translate\(|ACCENT_MAP|TRANSLITERATION_MAP/i,
    );
    // The only transliteration mention is the record field asserting there is none.
    expect(NORMALISER_CODE.match(/transliteration/gi)).toHaveLength(1);
    expect(NORMALISER_SOURCE).not.toMatch(/[áäøéèöüñ]{1,}"\s*:/);
  });

  it("performs no morphology, singularisation, stemming or synonym expansion", () => {
    expect(normaliseCanonicalTitle("Nurses")).toBe("nurses");
    expect(normaliseCanonicalTitle("Electricians")).toBe("electricians");
    expect(normaliseCanonicalTitle("Nursing")).not.toBe(normaliseCanonicalTitle("Nurse"));
    expect(NORMALISER_CODE).not.toMatch(/stem|lemmat|singular|plural|synonym|embedding/i);
    expect(CANONICAL_TITLE_PROHIBITIONS.join(" ")).toMatch(/No stemming/);
  });

  it("depends on no unaccent mechanism and no database function in the accepted path", () => {
    expect(CANONICAL_TITLE_UNICODE_MECHANISM.unaccentUsed).toBe(false);
    expect(NORMALISER_CODE).not.toMatch(/unaccent\s*\(|normalise_title\s*\(/i);
    // The only unaccent mention is the record field asserting it is unused.
    expect(NORMALISER_CODE.match(/unaccent\w*/gi)).toEqual(["unaccentUsed"]);
    expect([...D9_FORBIDDEN_DATABASE_OBJECTS]).toEqual([
      "normalise_title",
      "unaccent",
      "clear_routes_unaccent",
    ]);
  });

  it("is pure: no database, network, environment, clock or state access", () => {
    expect(NORMALISER_CODE).not.toMatch(
      /supabase|fetch\(|process\.env|import\.meta\.env|Date\.now|new Date|Math\.random/,
    );
  });
});

describe("Stage D9 persistence boundary", () => {
  it("always derives title_normalised from canonical_title", () => {
    const values = buildOccupationTitleWriteValues("Nurse—Practitioner");
    expect(values.canonicalTitle).toBe("Nurse—Practitioner");
    expect(values.titleNormalised).toBe("nurse practitioner");
    expect(Object.isFrozen(values)).toBe(true);
  });

  it("rejects an arbitrary mismatching title_normalised at the boundary", () => {
    expect(() =>
      assertOccupationTitleWriteValues({
        canonicalTitle: "Café Manager",
        titleNormalised: "something else entirely",
      }),
    ).toThrow(CanonicalTitleWriteError);
    try {
      assertOccupationTitleWriteValues({
        canonicalTitle: "Café Manager",
        titleNormalised: "Café Manager",
      });
      throw new Error("boundary accepted a mismatching canonical value");
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalTitleWriteError);
      expect((error as CanonicalTitleWriteError).rejection).toBe("title_normalised_mismatch");
    }
    expect(
      assertOccupationTitleWriteValues({
        canonicalTitle: "Café Manager",
        titleNormalised: "cafe manager",
      }).titleNormalised,
    ).toBe("cafe manager");
  });

  it("rejects blank and non-normalisable canonical titles", () => {
    expect(() => buildOccupationTitleWriteValues("   ")).toThrow(/canonical_title/);
    expect(() => buildOccupationTitleWriteValues("!!! ---")).toThrow(/empty canonical identity/);
  });

  it("keeps database constraints authoritative and adds no normalisation trigger", () => {
    expect(D9_INTEGRITY_MODEL.databaseNormalisationTrigger).toBe(false);
    expect(D9_INTEGRITY_MODEL.databaseGeneratedTitleColumn).toBe(false);
    const db = D9_INTEGRITY_MODEL.databaseAuthoritative.join(" ");
    expect(db).toMatch(/title_normalised text NOT NULL/);
    expect(db).toMatch(/never GENERATED/);
    expect(db).toMatch(/canonical_title text NOT NULL/);
    expect(db).toMatch(/uniqueness/);
    expect(db).toMatch(/trigram/);
  });
});

describe("Stage D9 additive reconciliation of D4, D7 and D8", () => {
  it("preserves D4 and D7 history rather than rewriting it", () => {
    expect([...NORMALISE_TITLE_OPERATIONS]).toEqual([...CANONICAL_TITLE_OPERATION_ORDER]);
    const occupationRecord = D7_AUTHORED_OBJECTS.find((entry) => entry.nodeKey === "occupation");
    expect(occupationRecord?.authoringStatus).toBe("not_authored_dependency_blocked");
    expect(D9_RECONCILIATION.entries.map((entry) => entry.code)).toEqual([
      "d9_d4_mechanism_superseded",
      "d9_normalise_title_no_longer_required",
      "d9_unaccent_remains_rejected",
    ]);
    for (const entry of D9_RECONCILIATION.entries) {
      expect(entry.preservedHistory.length).toBeGreaterThan(0);
    }
  });

  it("keeps Stage D8 historically blocked", () => {
    const d8 = assessD8UnaccentWrapperProof();
    expect(d8.wrapperDesignProven).toBe(false);
    expect(d8.blockers.length).toBeGreaterThan(0);
    expect(assessD9ApplicationNormalisation().d8RemainsBlocked).toBe(true);
  });

  it("no longer shows occupation blocked on normalise_title or unaccent", () => {
    const occupation = getD9CurrentNode("occupation");
    expect(occupation.dependsOn).not.toContain("normalise_title");
    expect(occupation.dependsOn).not.toContain("unaccent");
    expect([...occupation.dependsOn]).toEqual([
      "source",
      "taxonomy_import_batch",
      "internal_user",
      "occupation_status",
      "citext",
      "pg_trgm",
    ]);
    for (const node of D9_CURRENT_DEPENDENCY_NODES) {
      expect(node.dependsOn).not.toContain("unaccent");
    }
  });

  it("reconciles idempotently and mutates no other node", () => {
    const once = applyD9DependencyReconciliation();
    const twice = applyD9DependencyReconciliation(once);
    expect(JSON.stringify(twice)).toEqual(JSON.stringify(once));
    expect(Object.isFrozen(once)).toBe(true);
    for (const node of once) {
      if (node.key === "occupation") continue;
      expect(node).toBe(
        D9_CURRENT_DEPENDENCY_NODES.find((entry) => entry.key === node.key) as typeof node,
      );
    }
  });
});

describe("Stage D9 authoring and hosted boundaries", () => {
  it("authors no occupation SQL and no database normalise_title function", () => {
    expect(D9_OCCUPATION_SQL_AUTHORED).toBe(false);
    const authored = readdirSync("supabase/authored-migrations")
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(`supabase/authored-migrations/${name}`, "utf8"))
      .join("\n");
    expect(authored).not.toMatch(/create\s+(or\s+replace\s+)?function[^;]*normalise_title/i);
    expect(authored).not.toMatch(/create\s+table[^;]*\boccupation\b\s*\(/i);
    expect(authored).not.toMatch(/create\s+extension[^;]*unaccent/i);
  });

  it("leaves managed migrations at exactly nine", () => {
    const managed = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql"));
    expect(managed).toHaveLength(9);
    expect(D9_MIGRATION_FACTS.managedMigrationCount).toBe(9);
    expect(managed.join("\n")).not.toMatch(/unaccent|normalise_title|occupation/i);
  });

  it("claims no hosted apply or target verification authority", () => {
    const assessment = assessD9ApplicationNormalisation();
    expect(assessment.hostedApplyAuthorised).toBe(false);
    expect(D9_OWNER_ARCHITECTURE_DECISION.hostedApplyAuthorised).toBe(false);
    expect(D9_OWNER_ARCHITECTURE_DECISION.hostedSchemaApplicationAuthorised).toBe(false);
    expect(assessment.applicationNormalisationProven).toBe(true);
    expect(assessment.occupationBlockedOnNormaliseTitle).toBe(false);
    expect(assessment.occupationBlockedOnUnaccent).toBe(false);
    expect(assessment.remainingBlockers.length).toBeGreaterThan(0);
    expect(assessment.remainingBlockers.join(" ")).toMatch(/title_word_count/i);
    expect(Object.isFrozen(assessment)).toBe(true);
  });
  it("R1: states the narrow title_word_count blocker and no overstated one", () => {
    const assessment = assessD9ApplicationNormalisation();
    const text = assessment.remainingBlockers.join(" ");
    expect(D9_R1_OCCUPATION_AUTHORING_BLOCKER.blockerCode).toBe(
      "occupation_title_word_count_generated_expression_not_frozen",
    );
    expect(text).toContain(D9_R1_OCCUPATION_AUTHORING_BLOCKER.note);
    // Must never again claim the field list or partial predicate are unspecified.
    expect(text).not.toMatch(/complete frozen column list/i);
    expect(text).not.toMatch(/partial-uniqueness predicate (are|is) not enumerated/i);
    expect(text).not.toMatch(/occupation_column_contract_not_enumerated/i);
  });

  it("R1: records the occupation contract already frozen by the approved ERD", () => {
    expect(D9_R1_OCCUPATION_FROZEN_BY_ERD.columnListFrozen).toBe(true);
    expect(D9_R1_OCCUPATION_FROZEN_BY_ERD.activeTitlePartialUniquenessPredicateFrozen).toBe(true);
    expect(D9_R1_OCCUPATION_FROZEN_BY_ERD.constraints).toContain(
      "UNIQUE(title_normalised) WHERE status = 'active'",
    );
    expect(D9_R1_OCCUPATION_FROZEN_BY_ERD.writeAuthority).toBe("is_internal('approver') only");
    expect(D9_R1_OCCUPATION_FROZEN_BY_ERD.columns.join("\n")).toMatch(
      /title_word_count smallint NOT NULL GENERATED/,
    );
  });

  it("R1: keeps title_word_count database-generated and unauthored", () => {
    expect(D9_R1_OCCUPATION_AUTHORING_BLOCKER.titleWordCountRemainsDatabaseGenerated).toBe(true);
    const authored = readdirSync("supabase/authored-migrations")
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(`supabase/authored-migrations/${name}`, "utf8"))
      .join("\n");
    expect(authored).not.toMatch(/title_word_count/i);
  });

  it("R1: preserves the overstated blocker as superseded history", () => {
    expect(D9_OCCUPATION_AUTHORING_BLOCKER_SUPERSEDED_R1.status).toBe("superseded_overstated");
    expect(D9_OCCUPATION_AUTHORING_BLOCKER_SUPERSEDED_R1.supersededBy).toBe(
      D9_R1_OCCUPATION_AUTHORING_BLOCKER.blockerCode,
    );
    expect(D9_R1_RECONCILIATION.normaliserChanged).toBe(false);
    expect(D9_R1_RECONCILIATION.persistenceGuardsChanged).toBe(false);
    expect(D9_R1_RECONCILIATION.d8HistoryChanged).toBe(false);
    expect(D9_R1_RECONCILIATION.occupationSqlAuthored).toBe(false);
    expect(D9_R1_RECONCILIATION.hostedApplyAuthorised).toBe(false);
    expect(D9_R1_RECONCILIATION.targetProjectVerified).toBe(false);
  });
});
