import { describe, expect, it } from "vitest";

import { isBlankNormalised, normaliseOccupationText, normalisedTokens } from "../normalise";

/** Regression lock on the single deterministic normaliser. */
describe("occupation query normalisation", () => {
  it("applies NFKC compatibility normalisation", () => {
    expect(normaliseOccupationText("Ｓoftware Ｅngineer")).toBe("software engineer");
    expect(normaliseOccupationText("ﬁnancial adviser")).toBe("financial adviser");
  });

  it("trims and collapses whitespace runs including tabs and newlines", () => {
    expect(normaliseOccupationText("  registered\t\tnurse \n")).toBe("registered nurse");
    expect(normaliseOccupationText("police\u00a0officer")).toBe("police officer");
  });

  it("case-folds locale-independently", () => {
    expect(normaliseOccupationText("POLICE OFFICER")).toBe("police officer");
    expect(normaliseOccupationText("PoLiCe OfFiCeR")).toBe("police officer");
  });

  it("does not stem, de-pluralise, expand synonyms or strip punctuation", () => {
    expect(normaliseOccupationText("Nurses")).toBe("nurses");
    expect(normaliseOccupationText("Children's Nurse")).toBe("children's nurse");
    expect(normaliseOccupationText("H.G.V. Driver")).toBe("h.g.v. driver");
    expect(normaliseOccupationText("Nursing")).not.toBe(normaliseOccupationText("Nurse"));
  });

  it("is idempotent", () => {
    const once = normaliseOccupationText("  Civil   ENGINEER ");
    expect(normaliseOccupationText(once)).toBe(once);
  });

  it("reports blank input and tokenises deterministically", () => {
    expect(isBlankNormalised(normaliseOccupationText("   \t \n "))).toBe(true);
    expect(normalisedTokens(normaliseOccupationText("Police Officer"))).toEqual([
      "police",
      "officer",
    ]);
    expect(normalisedTokens("")).toEqual([]);
  });
});
