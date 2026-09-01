import { safeParseCanonicalCareerPack, type CareerPack } from "../career-packs";
import { hashCanonicalCareerPack } from "../career-pack-governance";
import { bindCareerPackOccupation, type OccupationUniverse } from "../occupation-universe";
import type { CoverageCatalogueIssue } from "./codes";
import {
  freezeCoverageDocument,
  type CareerPackCoverageCatalogue,
  type CoverageCatalogueEntry,
} from "./schema";

/**
 * Deterministic association of AVAILABLE Career Packs with canonical
 * occupations.
 *
 * Rules that make this safe:
 * - pack truth is RECOMPUTED (strict canonical parse + content hash); a
 *   caller-declared occupation mapping or hash is never trusted;
 * - occupation binding is exact identity only, via the closed Increment 12
 *   binder — no alias, no normalisation, no fuzzy matching;
 * - output is caller-order independent and universe-order independent;
 * - it fails CLOSED. Frozen governance provides no current-version selection
 *   semantic at this layer, so when two materially different packs claim one
 *   occupation the whole catalogue is rejected rather than silently resolved by
 *   max SemVer or array order.
 *
 * This is a pure input to coverage resolution: not a registry, not a live
 * publication service and not evidence that anything is published.
 */

export type CoverageCatalogueResult =
  | { readonly ok: true; readonly catalogue: CareerPackCoverageCatalogue }
  | { readonly ok: false; readonly issues: readonly CoverageCatalogueIssue[] };

interface ParsedPack {
  readonly pack: CareerPack;
  readonly contentHash: string;
}

function compareEntries(left: CoverageCatalogueEntry, right: CoverageCatalogueEntry): number {
  if (left.occupation.occupationKey < right.occupation.occupationKey) return -1;
  if (left.occupation.occupationKey > right.occupation.occupationKey) return 1;
  return 0;
}

export function buildCareerPackCoverageCatalogue(
  universe: OccupationUniverse,
  availablePacks: readonly unknown[],
): CoverageCatalogueResult {
  const issues: CoverageCatalogueIssue[] = [];
  const parsed: ParsedPack[] = [];

  availablePacks.forEach((input, index) => {
    const result = safeParseCanonicalCareerPack(input);
    if (!result.ok) {
      issues.push({
        code: "pack_invalid",
        message: "supplied Career Pack is not a valid canonical document",
        at: `availablePacks[${index}]`,
      });
      return;
    }
    parsed.push({ pack: result.pack, contentHash: hashCanonicalCareerPack(result.pack) });
  });

  /* Identical duplicates are collapsed; same identity + different content is a
     conflict, because there is no governed rule for which one is truth. */
  const byIdentity = new Map<string, ParsedPack>();
  for (const entry of parsed) {
    const identity = `${entry.pack.careerPackId}@${entry.pack.version}`;
    const existing = byIdentity.get(identity);
    if (existing && existing.contentHash !== entry.contentHash) {
      issues.push({
        code: "conflicting_pack_content",
        message: "the same Career Pack identity was supplied with different content",
        at: identity,
      });
      continue;
    }
    if (!existing) byIdentity.set(identity, entry);
  }

  const byOccupationKey = new Map<string, CoverageCatalogueEntry>();
  const conflicted = new Set<string>();

  for (const entry of [...byIdentity.values()]) {
    const binding = bindCareerPackOccupation(universe, entry.pack.occupation);
    if (!binding.ok) {
      issues.push({
        code: "pack_occupation_unbound",
        message: binding.message,
        at: `${entry.pack.careerPackId}@${entry.pack.version}`,
      });
      continue;
    }

    const occupation = {
      occupationId: binding.occupation.occupationId,
      occupationKey: binding.occupation.occupationKey,
      canonicalTitle: binding.occupation.canonicalTitle,
    };
    const candidate: CoverageCatalogueEntry = {
      occupation,
      pack: {
        careerPackId: entry.pack.careerPackId,
        version: entry.pack.version,
        contentHash: entry.contentHash,
      },
    };

    const existing = byOccupationKey.get(occupation.occupationKey);
    if (existing && existing.pack.contentHash !== candidate.pack.contentHash) {
      conflicted.add(occupation.occupationKey);
      continue;
    }
    if (!existing) byOccupationKey.set(occupation.occupationKey, candidate);
  }

  for (const occupationKey of [...conflicted].sort()) {
    issues.push({
      code: "competing_pack_support",
      message:
        "two or more materially different Career Packs claim the same canonical occupation and no governed current-version selection rule exists",
      at: occupationKey,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues: freezeCoverageDocument([...issues]) };
  }

  const catalogue = [...byOccupationKey.values()].sort(compareEntries);
  return { ok: true, catalogue: freezeCoverageDocument(catalogue) };
}

/** Exact-identity catalogue lookup. Never a title, alias or fuzzy lookup. */
export function catalogueEntryForOccupationId(
  catalogue: CareerPackCoverageCatalogue,
  occupationId: string,
): CoverageCatalogueEntry | undefined {
  return catalogue.find((entry) => entry.occupation.occupationId === occupationId);
}
