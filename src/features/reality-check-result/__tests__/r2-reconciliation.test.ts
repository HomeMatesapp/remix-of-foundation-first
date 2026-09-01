import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_RESULT_COPY } from "../../../content/reality-check-result-copy/architecture-tests";

/**
 * Increment 16 — R2 bounded external-inspection reconciliation.
 *
 * These are presentation-honesty regressions only. Nothing here evaluates,
 * re-derives or softens Decision Engine truth.
 */

const SOURCES = [
  "src/features/reality-check-result/view-model.ts",
  "src/features/reality-check-result/components/reality-check-outcome.tsx",
  "src/content/reality-check-result-copy/architecture-tests.ts",
].map((path) => readFileSync(path, "utf8"));

const SERVER = readFileSync("src/features/reality-check-result/evaluation.server.ts", "utf8");
const SCHEMA = readFileSync("src/features/reality-check-result/content-schema.ts", "utf8");
const OUTCOME = readFileSync(
  "src/features/reality-check-result/components/reality-check-outcome.tsx",
  "utf8",
);

describe("R2 — exact content-hash presentation binding", () => {
  it("authors an exact canonical content hash for every reviewed copy set", () => {
    expect(ARCHITECTURE_TEST_RESULT_COPY).toHaveLength(ARCHITECTURE_TEST_PACKS.length);
    for (const copy of ARCHITECTURE_TEST_RESULT_COPY) {
      expect(copy.careerPackContentHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("binds the browser against the server's pack ref rather than re-hashing", () => {
    expect(OUTCOME).toContain("resultCopyMatchesPackRef(copy, outcome.pack)");
    expect(OUTCOME).not.toContain("hashCanonicalCareerPack");
  });

  it("does not claim publication immutability governance", () => {
    expect(SCHEMA).toContain("not publication\n * immutability governance");
  });
});

describe("R2 — evidence attribution is never widened", () => {
  it("has no fallback from an empty relevant set to the whole evidence context", () => {
    expect(SERVER).not.toContain("narrowed.length > 0 ? narrowed : entries");
    expect(SERVER).toContain("return entries.filter((entry) => relevant.has(entry.evidenceKey));");
  });

  it("labels the sources section as related to what is shown, not as the basis", () => {
    expect(OUTCOME).toContain("Reviewed sources related to what is shown here");
    expect(OUTCOME).not.toContain("The sources this rests on");
  });
});

describe("R2 — neutral summary and narrowed scope wording", () => {
  it("does not rank obstacles or conditions the engine has not ranked", () => {
    for (const source of SOURCES) {
      expect(source).not.toContain("Biggest obstacle");
      expect(source).not.toContain("Most important outstanding condition");
    }
  });

  it("states plainly that local access has not been looked at", () => {
    expect(OUTCOME).toContain("has not been looked at");
    expect(OUTCOME).not.toContain(
      "No\n          location, employer, course or vacancy information",
    );
  });
});

describe("Increment 16 closure — accurate governance status in Career Pack content notes", () => {
  it("records the ranking content as product-owner accepted without implying publication", () => {
    for (const path of [
      "src/content/career-packs/architecture-tests/registered-nurse.ts",
      "src/content/career-packs/architecture-tests/solicitor-england-wales.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain("pending product-owner acceptance");
      expect(source).toContain("ACCEPTED by the product\n   * owner on 2026-08-27");
      expect(source).toContain("does not imply external publication or deployment");
    }
  });
});
