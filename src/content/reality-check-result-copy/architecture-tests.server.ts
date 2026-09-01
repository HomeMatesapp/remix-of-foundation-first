import { hashCanonicalCareerPack } from "../../domain/career-pack-governance/hash";
import { parseCareerResultCopySet } from "../../features/reality-check-result/content-schema";
import { ARCHITECTURE_TEST_PACKS } from "../career-packs/architecture-tests";
import { AUTHORED_ARCHITECTURE_TEST_RESULT_COPY } from "./architecture-tests";

/**
 * Increment 16 R3 — server-only, EXACT content-hash-bound load of the authored
 * participant result copy.
 *
 * This module is server-only: canonical Career Pack hashing is deliberately
 * server-side (`node:crypto`), so it must never enter a browser bundle. It is the
 * load used by the single server-only evaluation boundary — the only path that can
 * produce a participant result.
 *
 * The already-present canonical hashing implementation is REUSED; no second
 * hashing algorithm and no new dependency is introduced. Authored copy that
 * declares a `careerPackContentHash` other than the exact canonical hash of the
 * bound pack document fails closed at load, even when the pack id, version and
 * every stable key are unchanged.
 */
export const ARCHITECTURE_TEST_RESULT_COPY_HASH_BOUND = parseCareerResultCopySet(
  AUTHORED_ARCHITECTURE_TEST_RESULT_COPY,
  ARCHITECTURE_TEST_PACKS,
  hashCanonicalCareerPack,
);
