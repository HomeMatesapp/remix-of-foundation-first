import { useEffect, useId, useMemo, useReducer, useRef } from "react";

import type { CareerPackLocalRequirement } from "../../../domain/career-packs/schema";
import type { LocalRealitySnapshot } from "../../../domain/local-reality";
import { collectionReducer, handOffLocalPostcode, initialCollectionState } from "../collection";
import {
  LOCAL_REALITY_CHECK_LATER_LABEL,
  LOCAL_REALITY_SKIPPED,
  LOCAL_REALITY_SKIP_LABEL,
  POSTCODE_FIELD_HELP,
  POSTCODE_FIELD_LABEL,
} from "../copy";
import { buildLocalRealityPresentation, type LocalRealityItemView } from "../view-model";

/**
 * Increment 17 Stage C — the participant Local Reality section.
 *
 * It renders AROUND the closed Increment 16 result and never inside the
 * judgement derivation. It cannot change the judgement, eligibility, practical
 * fit, route availability, ranking, barriers or the engine's unresolved checks.
 *
 * The postcode is collected only when the bound Career Pack actually declares a
 * local requirement, is held in this component's memory only, and is cleared on
 * hand-off, on skip, on reset and whenever the bound occupation / pack identity
 * changes. It is never displayed back after hand-off: the only location shown
 * afterwards is the participant-safe snapshot `searchAreaLabel`.
 */

const CARD = "rounded-lg border border-border bg-card p-5";
const BODY = "text-[0.95rem] leading-relaxed text-muted-foreground";
const H3 = "text-base font-semibold text-foreground";

function ItemCard({ item }: { item: LocalRealityItemView }) {
  return (
    <li className={CARD}>
      <h4 className={H3}>{item.title ?? item.organisationName ?? "A reviewed local record"}</h4>
      {item.title !== null && item.organisationName !== null ? (
        <p className={`mt-1 ${BODY}`}>{item.organisationName}</p>
      ) : null}
      <ul className={`mt-2 space-y-1 ${BODY}`}>
        {item.locationLabel !== null ? <li>{item.locationLabel}</li> : null}
        {item.approxDistance !== null ? <li>{item.approxDistance}</li> : null}
        {item.details.map((detail) => (
          <li key={detail.detailKey}>{detail.detailText}</li>
        ))}
      </ul>
      <p className={`mt-2 text-sm text-muted-foreground`}>{item.provenance}</p>
    </li>
  );
}

export function LocalRealitySection({
  bindingKey,
  localRequirements,
  snapshot,
  sourceTitleBySourceId,
  onLocationSubmitted,
}: {
  /** Exact occupation + Career Pack content identity this section is bound to. */
  readonly bindingKey: string;
  readonly localRequirements: readonly CareerPackLocalRequirement[];
  /** Optional canonical snapshot supplied by the controlled Stage C boundary. */
  readonly snapshot?: LocalRealitySnapshot | null | undefined;
  readonly sourceTitleBySourceId?: Readonly<Record<string, string>> | undefined;
  /**
   * Transient hand-off. The value is passed once, for immediate use, and is not
   * retained by this component afterwards.
   */
  readonly onLocationSubmitted?: ((transientPostcode: string) => void) | undefined;
}) {
  const [state, dispatch] = useReducer(collectionReducer, initialCollectionState(bindingKey));
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* Identity change wipes the transient value; no cross-career carry-over. */
  useEffect(() => {
    dispatch({ type: "rebind", bindingKey });
  }, [bindingKey]);

  /* Unmount clears the transient value as well. */
  useEffect(() => () => dispatch({ type: "clear" }), []);

  useEffect(() => {
    if (state.status === "needs_correction") inputRef.current?.focus();
  }, [state.status]);

  const presentation = useMemo(
    () =>
      buildLocalRealityPresentation({
        localRequirements,
        snapshot,
        sourceTitleBySourceId,
        handedOff: state.status === "handed_off",
      }),
    [localRequirements, snapshot, sourceTitleBySourceId, state.status],
  );

  /* No declared local requirement: no location is requested at all. */
  if (!presentation.locationRelevant) return null;

  const submit = () => {
    /* One shared, directly testable hand-off boundary (see collection.ts). */
    handOffLocalPostcode(state, onLocationSubmitted);
    dispatch({ type: "submit" });
  };

  const showForm = state.status === "editing" || state.status === "needs_correction";

  return (
    <section aria-labelledby={`${inputId}-heading`} className="mt-12 border-t border-border pt-8">
      <h2
        id={`${inputId}-heading`}
        className="text-xl font-semibold tracking-tight text-foreground"
      >
        {presentation.heading}
      </h2>
      <p className={`mt-2 max-w-2xl ${BODY}`}>{presentation.separationNote}</p>

      <div className="mt-4 max-w-2xl space-y-2">
        {presentation.purpose.map((line) => (
          <p key={line} className={BODY}>
            {line}
          </p>
        ))}
      </div>

      {showForm ? (
        <form
          className="mt-5 max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
            {POSTCODE_FIELD_LABEL}
          </label>
          <p id={helpId} className="mt-1 text-sm text-muted-foreground">
            {POSTCODE_FIELD_HELP}
          </p>
          <input
            id={inputId}
            ref={inputRef}
            name="local-reality-postcode"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={state.typedValue}
            aria-describedby={state.correctionMessage === null ? helpId : `${helpId} ${errorId}`}
            aria-invalid={state.correctionMessage !== null}
            onChange={(event) => dispatch({ type: "type", value: event.target.value })}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <p id={errorId} role="status" className="mt-2 text-sm text-foreground">
            {state.correctionMessage}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Look for local information
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "skip" })}
              className="rounded-md border border-border px-5 py-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {LOCAL_REALITY_SKIP_LABEL}
            </button>
          </div>
        </form>
      ) : null}

      {state.status === "skipped" ? (
        <div className="mt-5 max-w-2xl">
          <p className={BODY}>{LOCAL_REALITY_SKIPPED}</p>
          <button
            type="button"
            onClick={() => dispatch({ type: "clear" })}
            className="mt-3 rounded-md border border-border px-5 py-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {LOCAL_REALITY_CHECK_LATER_LABEL}
          </button>
        </div>
      ) : null}

      {presentation.lookupNotConnectedNote !== null ? (
        <p className={`mt-5 max-w-2xl ${BODY}`}>{presentation.lookupNotConnectedNote}</p>
      ) : null}

      {presentation.searchAreaLabel !== null ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Area looked at: {presentation.searchAreaLabel}.
        </p>
      ) : null}

      <div className="mt-5 space-y-6">
        {presentation.requirements.map((requirement) => (
          <div key={requirement.localRequirementKey} className="max-w-2xl">
            {requirement.label !== null ? <h3 className={H3}>{requirement.label}</h3> : null}
            <p className="mt-1 text-sm font-semibold text-foreground">{requirement.heading}</p>
            <p className={`mt-1 ${BODY}`}>{requirement.explanation}</p>
            {requirement.outstandingCheckLabel !== null ? (
              <p className={`mt-1 ${BODY}`}>Still to check: {requirement.outstandingCheckLabel}.</p>
            ) : null}
            {requirement.items.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {requirement.items.map((item) => (
                  <ItemCard key={item.itemId} item={item} />
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
