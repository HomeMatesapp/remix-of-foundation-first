/**
 * Increment 17 Stage C — transient postcode collection state.
 *
 * PURE reducer. The typed value lives in controller memory only for as long as
 * the participant is editing it. It is never written to sessionStorage,
 * localStorage, cookies, IndexedDB, the URL, an analytics payload, a log, a
 * server function payload, a Career Pack, an AnswerSnapshot, an
 * EvidenceContextSnapshot, a Decision Engine input, a Local Reality snapshot or
 * any other durable surface, and it is cleared on hand-off, on explicit clear
 * and when the bound occupation / Career Pack identity changes.
 *
 * There is deliberately no retention constant here: nothing is retained, so no
 * retention policy is claimed.
 */

import { checkPostcodeShape } from "./postcode";

export type LocalPostcodeCollectionStatus =
  /** Nothing consequential has happened; a value may be part-typed. */
  | "editing"
  /** The typed value is not a full-postcode shape yet; it is preserved. */
  | "needs_correction"
  /** A transient normalised value was handed off; nothing is retained. */
  | "handed_off"
  /** The participant chose to leave the local check for now. */
  | "skipped";

export interface LocalPostcodeCollectionState {
  /** Exact occupation + Career Pack identity this collection state belongs to. */
  readonly bindingKey: string;
  /** Exactly what the participant typed, preserved verbatim while editing. */
  readonly typedValue: string;
  readonly status: LocalPostcodeCollectionStatus;
  /** Visible correction message, or null when there is nothing to correct. */
  readonly correctionMessage: string | null;
}

export type LocalPostcodeCollectionAction =
  | { readonly type: "type"; readonly value: string }
  | { readonly type: "submit" }
  | { readonly type: "skip" }
  | { readonly type: "clear" }
  | { readonly type: "rebind"; readonly bindingKey: string };

export function initialCollectionState(bindingKey: string): LocalPostcodeCollectionState {
  return Object.freeze({
    bindingKey,
    typedValue: "",
    status: "editing" as const,
    correctionMessage: null,
  });
}

/**
 * Decide whether a hand-off may happen, WITHOUT storing the transient value.
 *
 * Callers must treat `transientNormalised` as immediate-use-only: pass it to the
 * injected boundary and let it go out of scope. It is never placed in state.
 */
export function prepareHandOff(
  state: LocalPostcodeCollectionState,
):
  | { readonly ok: true; readonly transientNormalised: string }
  | { readonly ok: false; readonly message: string } {
  return checkPostcodeShape(state.typedValue);
}

/**
 * The EXACT hand-off boundary used by `LocalRealitySection.submit()`.
 *
 * This is the only place a transient normalised postcode is passed outward, so
 * the production path is directly testable: the injected callback is invoked
 * exactly once for a full-postcode-shaped value and never for a malformed or
 * empty one. Nothing is stored, logged, persisted or sent anywhere here.
 */
export function handOffLocalPostcode(
  state: LocalPostcodeCollectionState,
  handOff?: ((transientPostcode: string) => void) | undefined,
): { readonly invoked: boolean } {
  const outcome = prepareHandOff(state);
  if (!outcome.ok) return { invoked: false };
  handOff?.(outcome.transientNormalised);
  return { invoked: true };
}

export function collectionReducer(
  state: LocalPostcodeCollectionState,
  action: LocalPostcodeCollectionAction,
): LocalPostcodeCollectionState {
  switch (action.type) {
    case "type":
      return Object.freeze({
        ...state,
        typedValue: action.value,
        status: "editing" as const,
        correctionMessage: null,
      });

    case "submit": {
      const outcome = checkPostcodeShape(state.typedValue);
      if (!outcome.ok) {
        /* The typed value is PRESERVED so the participant can correct it. */
        return Object.freeze({
          ...state,
          status: "needs_correction" as const,
          correctionMessage: outcome.message,
        });
      }
      /* Hand-off clears the raw value immediately. Nothing is kept. */
      return Object.freeze({
        ...state,
        typedValue: "",
        status: "handed_off" as const,
        correctionMessage: null,
      });
    }

    case "skip":
      return Object.freeze({
        ...state,
        typedValue: "",
        status: "skipped" as const,
        correctionMessage: null,
      });

    case "clear":
      return initialCollectionState(state.bindingKey);

    case "rebind":
      /* An occupation / pack identity change starts completely fresh: one
       * career's local response can never cross-bind to another. */
      return initialCollectionState(action.bindingKey);

    default:
      return state;
  }
}
