import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import {
  ARCHITECTURE_TEST_RESULT_COPY,
  AUTHORED_ARCHITECTURE_TEST_RESULT_COPY,
} from "../../../content/reality-check-result-copy/architecture-tests";
import { ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND } from "../../../content/reality-check-result-copy/architecture-tests.server";
import { hashCanonicalCareerPack } from "../../../domain/career-pack-governance/hash";
import type { CareerPack } from "../../../domain/career-packs";
import { parseCareerResultCopySet, resultCopyCoverageDefects } from "../content-schema";

/**
 * Increment 16 — R3 bounded external-inspection reconciliation.
 *
 * Exact canonical content-hash binding of authored result copy must be true at
 * LOAD/PARSE time, not only later at evaluation runtime. Nothing here evaluates,
 * re-derives or softens Decision Engine truth.
 */

const NURSE = ARCHITECTURE_TEST_PACKS.find(
  (pack) => pack.occupation.occupationKey === "registered_nurse",
)!;

/** Same id, same version, same stable keys — different pack BYTES. */
function driftedPack(pack: CareerPack): CareerPack {
  const clone = structuredClone(pack) as unknown as {
    occupation: { occupationKey: string; occupationId?: string };
  };
  clone.occupation.occupationId = "9a1e0001-0001-4000-8000-0000000000ff";
  return clone as unknown as CareerPack;
}

describe("R3 — load-time exact content-hash binding", () => {
  it("loads the authored copy hash-bound on the server path", () => {
    expect(ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND).toHaveLength(ARCHITECTURE_TEST_PACKS.length);
    for (const copy of ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND) {
      const pack = ARCHITECTURE_TEST_PACKS.find(
        (candidate) => candidate.occupation.occupationKey === copy.occupationKey,
      )!;
      expect(copy.careerPackContentHash).toBe(hashCanonicalCareerPack(pack));
    }
  });

  it("rejects same-id, same-version, same-key pack CONTENT drift at parse time", () => {
    const packs = ARCHITECTURE_TEST_PACKS.map((pack) =>
      pack === NURSE ? driftedPack(pack) : pack,
    );
    expect(() =>
      parseCareerResultCopySet(
        AUTHORED_ARCHITECTURE_TEST_RESULT_COPY,
        packs,
        hashCanonicalCareerPack,
      ),
    ).toThrow(/content_hash_mismatch pack/);
  });

  it("still accepts the authored copy against the undrifted packs", () => {
    expect(() =>
      parseCareerResultCopySet(
        AUTHORED_ARCHITECTURE_TEST_RESULT_COPY,
        ARCHITECTURE_TEST_PACKS,
        hashCanonicalCareerPack,
      ),
    ).not.toThrow();
  });

  it("surfaces a precise content_hash_mismatch defect for entity pack", () => {
    const copy = ARCHITECTURE_TEST_RESULT_COPY.find(
      (entry) => entry.occupationKey === "registered_nurse",
    )!;
    const defects = resultCopyCoverageDefects(driftedPack(NURSE), copy, hashCanonicalCareerPack);
    expect(defects).toContainEqual({
      kind: "content_hash_mismatch",
      entity: "pack",
      key: `${copy.careerPackContentHash} != ${hashCanonicalCareerPack(driftedPack(NURSE))}`,
    });
  });

  it("keeps content-hash checking opt-in so the browser-safe module never hashes", () => {
    const copy = ARCHITECTURE_TEST_RESULT_COPY.find(
      (entry) => entry.occupationKey === "registered_nurse",
    )!;
    expect(resultCopyCoverageDefects(driftedPack(NURSE), copy)).toEqual([]);
    const browserSafe = readFileSync(
      "src/content/reality-check-result-copy/architecture-tests.ts",
      "utf8",
    );
    expect(browserSafe).not.toContain("hashCanonicalCareerPack");
    expect(
      readFileSync("src/features/reality-check-result/content-schema.ts", "utf8"),
    ).not.toContain("node:crypto");
  });

  it("keeps the runtime server and browser binding checks in place", () => {
    const server = readFileSync("src/features/reality-check-result/evaluation.server.ts", "utf8");
    expect(server).toContain("resultCopyBindsExactly(pack, copy, binding.pack.contentHash)");
    expect(server).toContain("ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND");
    expect(
      readFileSync(
        "src/features/reality-check-result/components/reality-check-outcome.tsx",
        "utf8",
      ),
    ).toContain("resultCopyMatchesPackRef(copy, outcome.pack)");
  });
});
