import { describe, expect, it } from "vitest";

import {
  collectionReducer,
  handOffLocalPostcode,
  initialCollectionState,
  prepareHandOff,
} from "../collection";
import { checkPostcodeShape } from "../postcode";

/**
 * Increment 17 Stage C — transient collection regressions.
 *
 * The raw postcode is memory-only, is preserved while editing, is cleared on
 * hand-off, skip, clear and identity change, and never reaches a hand-off when
 * the typed value is malformed.
 */

const BINDING = "registered-nurse:hash-a";

describe("postcode shape check", () => {
  it("accepts conservative full-postcode shapes without claiming existence", () => {
    for (const value of ["sw1a 1aa", "M11AE", " b33 8th ", "GIR 0AA", "CR2 6XH"]) {
      const outcome = checkPostcodeShape(value);
      expect(outcome.ok, value).toBe(true);
    }
  });

  it("rejects partial or malformed values with a visible correction message", () => {
    for (const value of ["", "   ", "SW1A", "12345", "SW1A 1A", "not a postcode"]) {
      const outcome = checkPostcodeShape(value);
      expect(outcome.ok, value).toBe(false);
      if (!outcome.ok) expect(outcome.message.length).toBeGreaterThan(10);
    }
  });
});

describe("collection reducer", () => {
  it("preserves the typed value while editing", () => {
    const state = collectionReducer(initialCollectionState(BINDING), {
      type: "type",
      value: "sw1a 1a",
    });
    expect(state.typedValue).toBe("sw1a 1a");
    expect(state.status).toBe("editing");
  });

  it("shows a correction and does not hand off a malformed value", () => {
    const typed = collectionReducer(initialCollectionState(BINDING), {
      type: "type",
      value: "SW1A",
    });
    expect(prepareHandOff(typed).ok).toBe(false);
    const submitted = collectionReducer(typed, { type: "submit" });
    expect(submitted.status).toBe("needs_correction");
    expect(submitted.correctionMessage).not.toBeNull();
    /* The value is kept so the participant can correct it. */
    expect(submitted.typedValue).toBe("SW1A");
  });

  it("clears the raw value on hand-off and keeps it out of state", () => {
    const typed = collectionReducer(initialCollectionState(BINDING), {
      type: "type",
      value: "sw1a 1aa",
    });
    const handOff = prepareHandOff(typed);
    expect(handOff.ok).toBe(true);
    if (handOff.ok) expect(handOff.transientNormalised).toBe("SW1A 1AA");

    const submitted = collectionReducer(typed, { type: "submit" });
    expect(submitted.status).toBe("handed_off");
    expect(submitted.typedValue).toBe("");
    expect(JSON.stringify(submitted)).not.toMatch(/SW1A/i);
  });

  it("clears the raw value on skip and on explicit clear", () => {
    const typed = collectionReducer(initialCollectionState(BINDING), {
      type: "type",
      value: "sw1a 1aa",
    });
    expect(collectionReducer(typed, { type: "skip" })).toMatchObject({
      typedValue: "",
      status: "skipped",
    });
    expect(collectionReducer(typed, { type: "clear" })).toEqual(initialCollectionState(BINDING));
  });

  it("cannot cross-bind one career's local response to another", () => {
    const typed = collectionReducer(initialCollectionState(BINDING), {
      type: "type",
      value: "sw1a 1aa",
    });
    const rebound = collectionReducer(typed, {
      type: "rebind",
      bindingKey: "electrician:hash-b",
    });
    expect(rebound).toEqual(initialCollectionState("electrician:hash-b"));
    expect(rebound.typedValue).toBe("");
    expect(rebound.status).toBe("editing");
  });
});

/* Stage C R1: the actual component hand-off boundary. `LocalRealitySection.submit()`
 * calls exactly this helper, so these assertions cover the production path. */
describe("stage C R1 — injected hand-off callback boundary", () => {
  function stateWith(value: string) {
    return collectionReducer(initialCollectionState(BINDING), { type: "type", value });
  }

  it("never invokes the injected callback for malformed input", () => {
    const calls: string[] = [];
    const state = stateWith("SW1A");
    const result = handOffLocalPostcode(state, (postcode) => calls.push(postcode));
    expect(result.invoked).toBe(false);
    expect(calls).toHaveLength(0);

    const next = collectionReducer(state, { type: "submit" });
    expect(next.status).toBe("needs_correction");
    expect(next.typedValue).toBe("SW1A");
    expect(next.correctionMessage).not.toBeNull();
  });

  it("never invokes the injected callback for empty input", () => {
    const calls: string[] = [];
    const result = handOffLocalPostcode(initialCollectionState(BINDING), (postcode) =>
      calls.push(postcode),
    );
    expect(result.invoked).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("invokes the callback exactly once with only the transient normalised postcode", () => {
    const calls: string[] = [];
    const state = stateWith("sw1a1aa");
    const result = handOffLocalPostcode(state, (postcode) => calls.push(postcode));
    expect(result.invoked).toBe(true);
    expect(calls).toEqual(["SW1A 1AA"]);

    const next = collectionReducer(state, { type: "submit" });
    expect(next.typedValue).toBe("");
    expect(next.status).toBe("handed_off");
    expect(JSON.stringify(next)).not.toMatch(/SW1A/i);
  });

  it("tolerates no injected callback at all without retaining anything", () => {
    const state = stateWith("SW1A 1AA");
    expect(handOffLocalPostcode(state).invoked).toBe(true);
    expect(handOffLocalPostcode(state, undefined).invoked).toBe(true);
  });
});
