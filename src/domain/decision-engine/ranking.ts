import type { CareerPack } from "../career-packs";
import type { RankingMetadata } from "../contracts";
import { compareCanonicalKeys } from "./canonical";
import { engineIssue, type DecisionEngineIssue } from "./codes";
import { evaluatePackRule, type AnswerIndex } from "./truth";

/**
 * Deterministic ranking: ordered inspectable factors only.
 *
 * There are NO scores, weights, arithmetic, directions or magnitudes. Factors
 * execute in the pack's AUTHORED order — that order is the canonical authored
 * data — and routes are compared lexicographically over the resulting ordered
 * boolean positive-match vector. An unknown factor is never a demerit.
 */

export interface RankedRoute {
  readonly routeKey: string;
  /** Ordered factor keys that positively matched this route. */
  readonly factorKeys: readonly string[];
  /** 1-based position in the final candidate ordering. */
  readonly position: number;
  readonly rankingConfigKey: string;
}

export interface RankingOutcome {
  /** Final candidate ordering by route key. */
  readonly order: readonly string[];
  /** Present only when exactly one ranking configuration was declared. */
  readonly metadata: ReadonlyMap<string, RankingMetadata>;
}

export function rankCandidateRoutes(args: {
  readonly pack: CareerPack;
  readonly answers: AnswerIndex;
  /** Candidate route keys in canonical order. */
  readonly candidateRouteKeys: readonly string[];
}):
  | { readonly ok: true; readonly outcome: RankingOutcome }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const { pack, answers, candidateRouteKeys } = args;

  if (pack.rankingConfigs.length === 0) {
    /* Unranked: canonical route-key order, and no ranking metadata is emitted. */
    return {
      ok: true,
      outcome: { order: [...candidateRouteKeys], metadata: new Map<string, RankingMetadata>() },
    };
  }

  if (pack.rankingConfigs.length > 1) {
    return {
      ok: false,
      issues: [
        engineIssue(
          "ambiguous_ranking_configuration",
          "more than one ranking configuration is declared and no governed selector exists; the engine refuses to choose",
          "rankingConfigs",
        ),
      ],
    };
  }

  const config = pack.rankingConfigs[0];
  if (!config) {
    return {
      ok: false,
      issues: [
        engineIssue("missing_pack_definition", "ranking configuration is absent", "rankingConfigs"),
      ],
    };
  }

  const issues: DecisionEngineIssue[] = [];
  const vectors = new Map<string, boolean[]>();
  const matched = new Map<string, string[]>();
  for (const routeKey of candidateRouteKeys) {
    vectors.set(routeKey, []);
    matched.set(routeKey, []);
  }

  for (const factor of config.factors) {
    const truth = evaluatePackRule(factor.preferWhen, answers);
    if (!truth.ok) {
      issues.push(...truth.issues);
      continue;
    }
    for (const routeKey of candidateRouteKeys) {
      const scoped = factor.routeKeys.length === 0 || factor.routeKeys.includes(routeKey);
      /* Only a determinately-true, in-scope factor is a positive match. */
      const positive = scoped && truth.value === true;
      vectors.get(routeKey)?.push(positive);
      if (positive) matched.get(routeKey)?.push(factor.factorKey);
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const order = [...candidateRouteKeys].sort((left, right) => {
    const leftVector = vectors.get(left) ?? [];
    const rightVector = vectors.get(right) ?? [];
    for (let index = 0; index < leftVector.length; index += 1) {
      const leftMatch = leftVector[index] === true;
      const rightMatch = rightVector[index] === true;
      if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
    }
    /* Exact ties: canonical route-key order only, for a deterministic total order. */
    return compareCanonicalKeys(left, right);
  });

  const metadata = new Map<string, RankingMetadata>();
  order.forEach((routeKey, index) => {
    metadata.set(routeKey, {
      rankingConfigKey: config.rankingConfigKey,
      factorKeys: matched.get(routeKey) ?? [],
      position: index + 1,
    });
  });

  return { ok: true, outcome: { order, metadata } };
}
