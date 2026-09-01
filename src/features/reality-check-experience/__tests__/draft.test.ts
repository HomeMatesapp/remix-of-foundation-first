import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { hashCanonicalCareerPack } from "../../../domain/career-pack-governance";
import type { CoveragePackRef } from "../../../domain/universal-coverage";
import {
  REALITY_CHECK_DRAFT_SCHEMA_VERSION,
  discardDraft,
  draftStorageKey,
  loadDraft,
  saveDraft,
} from "../draft";
import { answerFor } from "../flow";

/**
 * Increment 15 draft persistence is a BROWSER-SESSION draft only: `sessionStorage`,
 * never `localStorage`, never account-backed durable persistence. Anything
 * malformed, stale or bound to a different pack must be discarded, not coerced.
 */

const PACK = ARCHITECTURE_TEST_PACKS.find(
  (pack) => pack.occupation.occupationKey === "registered_nurse",
);
if (!PACK) throw new Error("registered nurse architecture-test pack missing");

/* Real recomputed pack truth, so exact-binding behaviour is under test. */
const PACK_REF: CoveragePackRef = {
  careerPackId: PACK.careerPackId,
  version: PACK.version,
  contentHash: hashCanonicalCareerPack(PACK),
};

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

let storage: MemoryStorage;

function installStorage(value: unknown): void {
  Object.defineProperty(globalThis, "sessionStorage", {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  storage = new MemoryStorage();
  installStorage(storage);
});

afterEach(() => {
  installStorage(undefined);
});

const FIRST_QUESTION = PACK.questionModules[0]?.questions[0];
if (!FIRST_QUESTION) throw new Error("registered nurse pack declares no question");
const FIRST_REF = {
  moduleCode: FIRST_QUESTION.moduleCode,
  questionKey: FIRST_QUESTION.questionKey,
};
const FIRST_VALUE =
  FIRST_QUESTION.input.kind === "single_select" ? FIRST_QUESTION.input.optionKeys[0]! : "unusable";
const SECOND_VALUE =
  FIRST_QUESTION.input.kind === "single_select"
    ? (FIRST_QUESTION.input.optionKeys[1] ?? FIRST_QUESTION.input.optionKeys[0]!)
    : "other";

describe("reality check session draft", () => {
  it("keys the draft by exact occupation and pack content hash", () => {
    const key = draftStorageKey("registered_nurse", PACK_REF);
    expect(key).toContain(REALITY_CHECK_DRAFT_SCHEMA_VERSION);
    expect(key).toContain("registered_nurse");
    expect(key).toContain(PACK_REF.contentHash);
  });

  it("round-trips a draft for the same exact pack ref", () => {
    saveDraft({
      occupationKey: "registered_nurse",
      packRef: PACK_REF,
      answers: [{ question: FIRST_REF, value: FIRST_VALUE }],
      stage: "questions",
    });
    const loaded = loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK });
    expect(loaded?.stage).toBe("questions");
    expect(answerFor(loaded?.answers ?? [], FIRST_REF)).toBe(FIRST_VALUE);
  });

  it("does not resume a draft written for a different pack content hash", () => {
    saveDraft({
      occupationKey: "registered_nurse",
      packRef: PACK_REF,
      answers: [{ question: FIRST_REF, value: FIRST_VALUE }],
    });
    const stalePackRef = { ...PACK_REF, contentHash: "d".repeat(64) };
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: stalePackRef, pack: PACK }),
    ).toBeUndefined();
  });

  it("discards a draft whose stored pack ref contradicts its storage key", () => {
    storage.setItem(
      draftStorageKey("registered_nurse", PACK_REF),
      JSON.stringify({
        draftSchemaVersion: REALITY_CHECK_DRAFT_SCHEMA_VERSION,
        occupationKey: "registered_nurse",
        pack: { ...PACK_REF, version: "9.9.9" },
        answers: [],
      }),
    );
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
    expect(storage.getItem(draftStorageKey("registered_nurse", PACK_REF))).toBeNull();
  });

  it("discards malformed JSON and unknown draft schema versions", () => {
    const key = draftStorageKey("registered_nurse", PACK_REF);
    storage.setItem(key, "{not json");
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();

    storage.setItem(
      key,
      JSON.stringify({
        draftSchemaVersion: "0.0.1",
        occupationKey: "registered_nurse",
        pack: PACK_REF,
        answers: [],
      }),
    );
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
  });

  it("discards a draft containing an unknown question ref or invalid value", () => {
    const key = draftStorageKey("registered_nurse", PACK_REF);
    const base = {
      draftSchemaVersion: REALITY_CHECK_DRAFT_SCHEMA_VERSION,
      occupationKey: "registered_nurse",
      pack: PACK_REF,
    };

    storage.setItem(
      key,
      JSON.stringify({
        ...base,
        answers: [{ question: { moduleCode: "driving", questionKey: "ghost" }, value: "x" }],
      }),
    );
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();

    storage.setItem(
      key,
      JSON.stringify({
        ...base,
        answers: [{ question: FIRST_REF, value: "not_a_declared_option_key" }],
      }),
    );
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
  });

  it("discards a draft containing the same question ref twice", () => {
    const key = draftStorageKey("registered_nurse", PACK_REF);
    /* Last-write-wins vs first-match-wins would diverge, so this is malformed. */
    storage.setItem(
      key,
      JSON.stringify({
        draftSchemaVersion: REALITY_CHECK_DRAFT_SCHEMA_VERSION,
        occupationKey: "registered_nurse",
        pack: PACK_REF,
        answers: [
          { question: FIRST_REF, value: FIRST_VALUE },
          { question: FIRST_REF, value: SECOND_VALUE },
        ],
      }),
    );
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
    expect(storage.getItem(key)).toBeNull();
  });

  it("discards a duplicated ref even when both values are identical", () => {
    const key = draftStorageKey("registered_nurse", PACK_REF);
    storage.setItem(
      key,
      JSON.stringify({
        draftSchemaVersion: REALITY_CHECK_DRAFT_SCHEMA_VERSION,
        occupationKey: "registered_nurse",
        pack: PACK_REF,
        answers: [
          { question: FIRST_REF, value: FIRST_VALUE },
          { question: FIRST_REF, value: FIRST_VALUE },
        ],
      }),
    );
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
    expect(storage.getItem(key)).toBeNull();
  });

  it("stores no identity, result, judgement or location data", () => {
    saveDraft({
      occupationKey: "registered_nurse",
      packRef: PACK_REF,
      answers: [{ question: FIRST_REF, value: FIRST_VALUE }],
      stage: "review",
    });
    const raw = storage.getItem(draftStorageKey("registered_nurse", PACK_REF)) ?? "";
    for (const forbidden of [
      "userId",
      "appUserId",
      "institution",
      "judgement",
      "realistic",
      "postcode",
      "evidence",
      "result",
      "score",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual([
      "answers",
      "draftSchemaVersion",
      "occupationKey",
      "pack",
      "stage",
    ]);
  });

  it("start over clears only this feature's draft for this pack", () => {
    storage.setItem("unrelated-app-key", "keep me");
    saveDraft({
      occupationKey: "registered_nurse",
      packRef: PACK_REF,
      answers: [{ question: FIRST_REF, value: FIRST_VALUE }],
    });
    discardDraft("registered_nurse", PACK_REF);
    expect(storage.getItem(draftStorageKey("registered_nurse", PACK_REF))).toBeNull();
    expect(storage.getItem("unrelated-app-key")).toBe("keep me");
  });

  it("degrades safely when session storage is unavailable or throws", () => {
    installStorage(undefined);
    expect(() =>
      saveDraft({
        occupationKey: "registered_nurse",
        packRef: PACK_REF,
        answers: [{ question: FIRST_REF, value: FIRST_VALUE }],
      }),
    ).not.toThrow();
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
    expect(() => discardDraft("registered_nurse", PACK_REF)).not.toThrow();

    installStorage({
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    });
    expect(
      loadDraft({ occupationKey: "registered_nurse", packRef: PACK_REF, pack: PACK }),
    ).toBeUndefined();
    expect(() =>
      saveDraft({
        occupationKey: "registered_nurse",
        packRef: PACK_REF,
        answers: [{ question: FIRST_REF, value: FIRST_VALUE }],
      }),
    ).not.toThrow();
    expect(() => discardDraft("registered_nurse", PACK_REF)).not.toThrow();
  });
});
