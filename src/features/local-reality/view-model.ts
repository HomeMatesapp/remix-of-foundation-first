/**
 * Increment 17 Stage C — Local Reality presentation view-model.
 *
 * Built from ESTABLISHED inputs only:
 *  - the exact bound Career Pack local requirement declarations;
 *  - an optional canonical CLOSED Stage A `LocalRealitySnapshot` supplied by a
 *    controlled Stage C boundary;
 *  - the CLOSED Stage B `resolveLocalRequirements()` output.
 *
 * It invents nothing. It computes no distance, reads no coordinates, performs no
 * lookup, and never interprets `availabilityConfidenceKey`. It is a SEPARATE
 * envelope from the Increment 16 result view-model: it cannot rewrite the
 * judgement, eligibility, practical fit, route availability, ranking, barrier
 * semantics or the engine's own unresolved checks.
 *
 * The raw postcode never reaches this module.
 */

import type { CareerPackLocalRequirement } from "../../domain/career-packs/schema";
import {
  resolveLocalRequirements,
  type LocalRealitySnapshot,
  type LocalRequirementResolutionState,
  type LocalSnapshotItem,
} from "../../domain/local-reality";
import {
  LOCAL_REALITY_HEADING,
  LOCAL_REALITY_LOOKUP_NOT_CONNECTED,
  LOCAL_REALITY_NOT_RELEVANT,
  LOCAL_REALITY_PURPOSE,
  LOCAL_REALITY_SEPARATION_NOTE,
  approxDistanceLabel,
  localStateCopy,
  recordedOnLabel,
  reviewedLocalLabel,
} from "./copy";

export interface LocalRealityItemView {
  readonly itemId: string;
  readonly objectType: LocalSnapshotItem["objectType"];
  readonly title: string | null;
  readonly organisationName: string | null;
  readonly locationLabel: string | null;
  readonly approxDistance: string | null;
  readonly details: readonly { readonly detailKey: string; readonly detailText: string }[];
  /** Provenance carried by the snapshot itself, plus any supplied source title. */
  readonly provenance: string;
}

export interface LocalRequirementView {
  /** Stable key retained for React keys only; never rendered as text. */
  readonly localRequirementKey: string;
  /** Reviewed label, or null when no reviewed copy exists for this key. */
  readonly label: string | null;
  readonly state: LocalRequirementResolutionState;
  readonly heading: string;
  readonly explanation: string;
  /** Reviewed label for an authored outstanding check key, or null. */
  readonly outstandingCheckLabel: string | null;
  readonly items: readonly LocalRealityItemView[];
}

export interface LocalRealityPresentation {
  /** True only when the bound pack actually declares a local requirement. */
  readonly locationRelevant: boolean;
  readonly heading: string;
  readonly separationNote: string;
  readonly notRelevantNote: string | null;
  readonly purpose: readonly string[];
  /** The ONLY location display authority: a participant-safe snapshot label. */
  readonly searchAreaLabel: string | null;
  readonly snapshotSupplied: boolean;
  /** Honest statement when no snapshot boundary has supplied anything. */
  readonly lookupNotConnectedNote: string | null;
  readonly requirements: readonly LocalRequirementView[];
}

function itemView(
  item: LocalSnapshotItem,
  sourceTitleBySourceId: Readonly<Record<string, string>>,
): LocalRealityItemView {
  const sourceTitle = sourceTitleBySourceId[item.sourceId] ?? null;
  const recordedOn = recordedOnLabel(item.capturedAt);
  const from = sourceTitle === null ? "a reviewed source" : sourceTitle;
  const provenance =
    recordedOn === null ? `Recorded from ${from}.` : `Recorded from ${from} on ${recordedOn}.`;

  return Object.freeze({
    itemId: item.itemId,
    objectType: item.objectType,
    title: item.itemTitle ?? null,
    organisationName: item.organisationName ?? null,
    locationLabel: item.locationLabel ?? null,
    /* Already-established snapshot fact, never computed here. */
    approxDistance: approxDistanceLabel(item.approxDistanceMiles),
    details: Object.freeze(
      item.details.map((detail) =>
        Object.freeze({ detailKey: detail.detailKey, detailText: detail.detailText }),
      ),
    ),
    provenance,
  });
}

/**
 * Build the Local Reality presentation.
 *
 * With no declared local requirement the presentation is inert: location is not
 * relevant, and no postcode may be requested.
 */
export function buildLocalRealityPresentation(input: {
  readonly localRequirements: readonly CareerPackLocalRequirement[];
  readonly snapshot?: LocalRealitySnapshot | null | undefined;
  readonly sourceTitleBySourceId?: Readonly<Record<string, string>> | undefined;
  /** True once a postcode has been handed to the (future) lookup boundary. */
  readonly handedOff?: boolean | undefined;
}): LocalRealityPresentation {
  const declarations = input.localRequirements;
  const snapshot = input.snapshot ?? null;
  const sourceTitles = input.sourceTitleBySourceId ?? {};

  if (declarations.length === 0) {
    return Object.freeze({
      locationRelevant: false,
      heading: LOCAL_REALITY_HEADING,
      separationNote: LOCAL_REALITY_SEPARATION_NOTE,
      notRelevantNote: LOCAL_REALITY_NOT_RELEVANT,
      purpose: Object.freeze([] as readonly string[]),
      searchAreaLabel: null,
      snapshotSupplied: false,
      lookupNotConnectedNote: null,
      requirements: Object.freeze([] as readonly LocalRequirementView[]),
    });
  }

  const resolved = resolveLocalRequirements({ localRequirements: declarations, snapshot });
  const itemsById = new Map<string, LocalSnapshotItem>();
  if (snapshot) for (const item of snapshot.items) itemsById.set(item.itemId, item);

  const requirements = resolved.resolutions.map((resolution) => {
    const copy = localStateCopy(resolution.resolution);
    return Object.freeze({
      localRequirementKey: resolution.localRequirementKey,
      label: reviewedLocalLabel(resolution.localRequirementKey),
      state: resolution.resolution,
      heading: copy.heading,
      explanation: copy.explanation,
      outstandingCheckLabel: reviewedLocalLabel(resolution.outstandingCheckKey),
      /* Exact matching item ids only, in the deterministic Stage B order. */
      items: Object.freeze(
        resolution.matchingItemIds.flatMap((itemId) => {
          const item = itemsById.get(itemId);
          return item ? [itemView(item, sourceTitles)] : [];
        }),
      ),
    });
  });

  const noUsableSnapshot = !resolved.locationUsable;

  return Object.freeze({
    locationRelevant: true,
    heading: LOCAL_REALITY_HEADING,
    separationNote: LOCAL_REALITY_SEPARATION_NOTE,
    notRelevantNote: null,
    purpose: LOCAL_REALITY_PURPOSE,
    /* Participant-safe snapshot label is the only location we ever show back. */
    searchAreaLabel: snapshot?.searchAreaLabel ?? null,
    snapshotSupplied: snapshot !== null,
    lookupNotConnectedNote:
      input.handedOff === true && noUsableSnapshot ? LOCAL_REALITY_LOOKUP_NOT_CONNECTED : null,
    requirements: Object.freeze(requirements),
  });
}
