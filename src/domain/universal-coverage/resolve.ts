import {
  safeParseCanonicalOccupationUniverse,
  type OccupationClarificationReason,
  type OccupationRef,
} from "../occupation-universe";
import { buildUnrecognisedIntentCapture } from "./capture";
import type { CoverageResolutionIssue, CoverageSupportDepth, CoverageTrustIssue } from "./codes";
import { buildProvisionalAssessmentPlan } from "./provisional";
import { buildCareerPackCoverageCatalogue, catalogueEntryForOccupationId } from "./catalogue";
import {
  freezeCoverageDocument,
  type CareerPackCoverageCatalogue,
  type CoverageOccupationRef,
  type CoveragePackRef,
  type ProvisionalAssessmentPlan,
  type UnrecognisedIntentCapture,
} from "./schema";
import { verifyOccupationIntent, type VerifiedOccupationIntent } from "./trust";

/**
 * Universal Reality Check coverage resolution.
 *
 * The single supported public entry point starts from the canonical occupation
 * universe plus RAW available Career Packs, so canonical truth is re-established
 * inside the call path:
 *
 * - the universe is strict-parsed through the closed Increment 12 boundary;
 * - the supplied Increment 12 `OccupationResolution` is treated as untrusted
 *   runtime input and reconciled against that canonical universe;
 * - every pack is strict-parsed, exact-bound and content-hashed before any
 *   `full_assessment_available` outcome can exist.
 *
 * A caller therefore cannot hand this layer a fabricated catalogue entry, a
 * fabricated content hash or a fabricated resolved occupation and obtain
 * support. The low-level catalogue-based resolver below is deliberately
 * module-private and is NOT exported from the package barrel.
 *
 * This layer is not a second authority: it never runs the shared Decision
 * Engine, never creates answer or evidence snapshots, never invents a Career
 * Pack, and never infers regulation, routes, conditions, source strength,
 * salary, demand or local facts.
 */

export interface FullAssessmentAvailable {
  readonly outcome: "full_assessment_available";
  readonly supportDepth: Extract<CoverageSupportDepth, "exact_career_pack">;
  readonly occupation: CoverageOccupationRef;
  /** Exact pack identity, authored version and RECOMPUTED content hash. */
  readonly pack: CoveragePackRef;
  /** Always false: the engine-backed run belongs to a later layer. */
  readonly engineExecuted: false;
}

export interface ProvisionalAssessmentAvailable {
  readonly outcome: "provisional_assessment_available";
  readonly supportDepth: Extract<CoverageSupportDepth, "not_yet_supported">;
  readonly occupation: CoverageOccupationRef;
  readonly plan: ProvisionalAssessmentPlan;
}

export interface CoverageClarificationRequired {
  readonly outcome: "clarification_required";
  readonly reason: OccupationClarificationReason;
  /** Canonical candidates, deterministic and never silently narrowed to one. */
  readonly candidates: readonly OccupationRef[];
}

export interface CoverageDemandCaptureRequired {
  readonly outcome: "demand_capture_required";
  readonly capture: UnrecognisedIntentCapture;
}

export type RealityCheckCoverage =
  | FullAssessmentAvailable
  | ProvisionalAssessmentAvailable
  | CoverageClarificationRequired
  | CoverageDemandCaptureRequired;

export type RealityCheckCoverageResult =
  | { readonly ok: true; readonly coverage: RealityCheckCoverage }
  | { readonly ok: false; readonly issues: readonly CoverageResolutionIssue[] };

export interface CoverageResolutionInput {
  /**
   * An existing Increment 12 `OccupationResolution`. Accepted as `unknown`
   * because it is untrusted at this boundary and is reconciled against the
   * canonical universe before use.
   */
  readonly occupationResolution: unknown;
  /** Canonical occupation universe input; strict-parsed inside this call. */
  readonly universe: unknown;
  /** Raw available Career Pack documents; strict-parsed inside this call. */
  readonly availablePacks: readonly unknown[];
}

/**
 * Package-private: resolves already-verified intent against an already-validated
 * catalogue. Never exported, because a catalogue value alone carries no runtime
 * proof that its content hashes were recomputed from canonical packs.
 */
function resolveVerifiedIntent(
  intent: VerifiedOccupationIntent,
  catalogue: CareerPackCoverageCatalogue,
): RealityCheckCoverage {
  if (intent.kind === "clarification_required") {
    /* Ambiguous identity: no assessment state of any kind may be created. */
    return freezeCoverageDocument({
      outcome: "clarification_required",
      reason: intent.reason,
      candidates: intent.candidates.map((candidate) => ({ ...candidate })),
    } satisfies CoverageClarificationRequired);
  }

  if (intent.kind === "unmatched") {
    return freezeCoverageDocument({
      outcome: "demand_capture_required",
      capture: buildUnrecognisedIntentCapture({
        rawQuery: intent.rawQuery,
        normalisedQuery: intent.normalisedQuery,
        unmatchedReason: intent.reason,
      }),
    } satisfies CoverageDemandCaptureRequired);
  }

  const occupation = { ...intent.occupation };
  const supported = catalogueEntryForOccupationId(catalogue, occupation.occupationId);
  if (supported && supported.occupation.occupationKey === occupation.occupationKey) {
    return freezeCoverageDocument({
      outcome: "full_assessment_available",
      supportDepth: "exact_career_pack",
      occupation,
      pack: { ...supported.pack },
      engineExecuted: false,
    } satisfies FullAssessmentAvailable);
  }

  return freezeCoverageDocument({
    outcome: "provisional_assessment_available",
    supportDepth: "not_yet_supported",
    occupation,
    plan: buildProvisionalAssessmentPlan(occupation),
  } satisfies ProvisionalAssessmentAvailable);
}

/**
 * The supported public safe API.
 *
 * Fails closed with frozen issues on any trust-boundary or catalogue integrity
 * failure, rather than throwing or degrading a contradiction to provisional
 * support.
 */
export function resolveRealityCheckCoverageFromPacks(
  input: CoverageResolutionInput,
): RealityCheckCoverageResult {
  const universe = safeParseCanonicalOccupationUniverse(input.universe);
  if (!universe.ok) {
    const issues: readonly CoverageTrustIssue[] = universe.issues.map((issue) => ({
      code: "occupation_universe_invalid" as const,
      message: issue.message,
      ...(issue.at === undefined ? {} : { at: issue.at }),
    }));
    return { ok: false, issues: freezeCoverageDocument([...issues]) };
  }

  const intent = verifyOccupationIntent(universe.universe, input.occupationResolution);
  if (!intent.ok) return { ok: false, issues: freezeCoverageDocument([...intent.issues]) };

  const built = buildCareerPackCoverageCatalogue(universe.universe, input.availablePacks);
  if (!built.ok) return { ok: false, issues: freezeCoverageDocument([...built.issues]) };

  return { ok: true, coverage: resolveVerifiedIntent(intent.intent, built.catalogue) };
}
