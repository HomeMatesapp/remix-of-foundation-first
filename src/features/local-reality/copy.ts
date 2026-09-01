/**
 * Increment 17 Stage C — reviewed participant copy for the Local Reality
 * section.
 *
 * Every string here is written to stay inside the closed Stage A / Stage B
 * meaning. In particular, the absence of matching governed local evidence is
 * described ONLY as Clear Routes not currently holding that evidence. It is
 * never described as nothing existing, as unavailable, inaccessible,
 * impossible, unmet, not eligible or not realistic, and it never changes the
 * Reality Check judgement.
 *
 * Raw internal stable keys are never surfaced. An authored check key is shown
 * only through the reviewed label map below; when no reviewed label exists the
 * label is omitted rather than leaking the key.
 */

import type { LocalRequirementResolutionState } from "../../domain/local-reality";

/** Why location is being asked for, before anything is typed. */
export const LOCAL_REALITY_PURPOSE: readonly string[] = Object.freeze([
  "For this career, some of what matters depends on where you are. Your postcode would be used only to look for reviewed route, training and opportunity information recorded near you.",
  "It is not part of the entry conditions or the practical-fit judgement you have just seen, and it cannot change that judgement.",
  "If we do not currently hold a nearby example, that is a limit of what we hold. It does not mean a route is closed to you.",
  "Your postcode is used for this check only. It is not saved to your browser, not put in the web address, and not stored to any account.",
]);

/** Shown when the bound Career Pack declares no local requirement at all. */
export const LOCAL_REALITY_NOT_RELEVANT =
  "For this career, the reviewed conditions do not depend on where you are, so Clear Routes does not ask for your location.";

/** Heading for the section, kept clearly separate from the judgement. */
export const LOCAL_REALITY_HEADING = "Local information for this career";

export const LOCAL_REALITY_SEPARATION_NOTE =
  "This section sits alongside your Reality Check result. Nothing here rewrites your judgement, the routes, the conditions or what is still to be checked.";

/** Shown after a postcode has been handed off with no lookup connected. */
export const LOCAL_REALITY_LOOKUP_NOT_CONNECTED =
  "Thank you. The live local search is not connected in this build stage, so Clear Routes has nothing local to show you yet. Nothing negative has been concluded, and no route has been ruled out.";

/** Shown when the participant chooses to leave it for now. */
export const LOCAL_REALITY_SKIPPED =
  "Left for now. The local part has not been checked, and that has not counted against you anywhere in your result.";

export const LOCAL_REALITY_SKIP_LABEL = "Skip for now";
export const LOCAL_REALITY_CHECK_LATER_LABEL = "Check this later";
export const POSTCODE_FIELD_LABEL = "Your full UK postcode";
export const POSTCODE_FIELD_HELP =
  "Used only for this local check, and only in this browser tab while you are on this page.";

/* -------------------------------------------------------------------------- */
/* State copy                                                                 */
/* -------------------------------------------------------------------------- */

interface StateCopy {
  readonly heading: string;
  readonly explanation: string;
}

const STATE_COPY: Readonly<Record<LocalRequirementResolutionState, StateCopy>> = Object.freeze({
  location_not_supplied: {
    heading: "Not checked locally yet",
    explanation:
      "Clear Routes has not looked at anything local for this yet. Where you are is relevant here, so you can add your postcode when you want to. Leaving it means only that this part is outstanding.",
  },
  matching_local_evidence_present: {
    heading: "Reviewed local information we hold",
    explanation:
      "These are the reviewed records Clear Routes holds for this near the area you gave. They are recorded facts, not a recommendation, and they are not a promise of a place, a course or a job.",
  },
  local_evidence_insufficient: {
    heading: "We do not currently hold matching local information",
    explanation:
      "Clear Routes does not currently hold reviewed local information matching this in the local snapshot it looked at. That is a limit of what we hold. It says nothing about whether something exists near you.",
  },
});

export function localStateCopy(state: LocalRequirementResolutionState): StateCopy {
  return STATE_COPY[state];
}

/* -------------------------------------------------------------------------- */
/* Reviewed labels for authored keys                                          */
/* -------------------------------------------------------------------------- */

/**
 * Reviewed participant-safe labels for authored local requirement keys and
 * authored outstanding check keys. Anything not listed is OMITTED: a raw stable
 * key is never rendered.
 */
const REVIEWED_LABELS: Readonly<Record<string, string>> = Object.freeze({
  local_approved_programme_access: "Getting to an approved nursing programme",
  check_local_approved_programme_access:
    "Whether an approved nursing programme is within reach of where you live",
});

export function reviewedLocalLabel(key: string | null | undefined): string | null {
  if (typeof key !== "string") return null;
  return REVIEWED_LABELS[key] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Snapshot fact formatting                                                   */
/* -------------------------------------------------------------------------- */

const MONTHS: readonly string[] = Object.freeze([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

/**
 * Format an ISO timestamp's date part deterministically, with no clock, no
 * locale dependency and no time zone maths.
 */
export function recordedOnLabel(isoTimestamp: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoTimestamp);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return null;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

/**
 * Present an ALREADY-ESTABLISHED snapshot distance. Nothing is computed here:
 * the number is copied from the snapshot fact and described as approximate.
 */
export function approxDistanceLabel(miles: number | null | undefined): string | null {
  if (typeof miles !== "number") return null;
  if (miles === 0) return "Recorded as in your area";
  const rendered = Number.isInteger(miles) ? String(miles) : miles.toFixed(1);
  return `About ${rendered} ${miles === 1 ? "mile" : "miles"} away, as recorded`;
}
