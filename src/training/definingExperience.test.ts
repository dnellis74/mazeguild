import { describe, expect, it } from "vitest";
import {
  definingExperienceCandidates,
  pickDefiningExperienceForAlignment,
} from "./definingExperience";

describe("definingExperienceCandidates (direct alignment pick)", () => {
  it("for LG collects options scoring law +2 or good +2", () => {
    const cands = definingExperienceCandidates("lg");
    expect(cands.length).toBeGreaterThan(0);
    // Spot-check known strong LG-leaning responses exist in the pool.
    expect(
      cands.some((c) => c.questionId === "purse" && c.optionId === "return"),
    ).toBe(true);
    expect(
      cands.some((c) => c.questionId === "purse" && c.optionId === "author"),
    ).toBe(true);
  });

  it("for LN only uses the ethics (±2 law) axis", () => {
    const cands = definingExperienceCandidates("ln");
    expect(cands.some((c) => c.optionId === "keep")).toBe(true);
    // return is good+2 / law+1 — not law+2, so excluded when only ethics is non-neutral.
    expect(
      cands.some((c) => c.questionId === "purse" && c.optionId === "return"),
    ).toBe(false);
  });

  it("for True Neutral returns no candidates (both axes neutral)", () => {
    expect(definingExperienceCandidates("n")).toEqual([]);
    expect(pickDefiningExperienceForAlignment("n")).toBeNull();
  });

  it("picks deterministically from the candidate set with a fixed rng", () => {
    const a = pickDefiningExperienceForAlignment("cg", "human", () => 0);
    const b = pickDefiningExperienceForAlignment("cg", "human", () => 0);
    expect(a).toEqual(b);
    expect(a?.scenario).toBeTruthy();
    expect(a?.label).toBeTruthy();
  });

  it("includes race extras when raceId is provided", () => {
    const withRace = definingExperienceCandidates("ln", "dwarf");
    const base = definingExperienceCandidates("ln");
    expect(withRace.length).toBeGreaterThanOrEqual(base.length);
    expect(withRace.some((c) => c.questionId === "hold")).toBe(true);
  });
});
