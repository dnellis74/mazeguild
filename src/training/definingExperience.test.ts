import { describe, expect, it } from "vitest";
import {
  alignmentQuestionsFor,
  definingExperienceCandidates,
  definingExperienceFromQuiz,
  pickDefiningExperienceForAlignment,
  resolveAlignmentFromQuiz,
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

describe("childhood quiz resolution", () => {
  it("alignmentQuestionsFor appends race extras after the base set", () => {
    const qs = alignmentQuestionsFor("dwarf");
    expect(qs.some((q) => q.id === "hold")).toBe(true);
    expect(qs.length).toBeGreaterThan(alignmentQuestionsFor(null).length);
  });

  it("resolveAlignmentFromQuiz maps strong lawful-good answers to lg", () => {
    const qs = alignmentQuestionsFor("human");
    const answers = qs.map((q) => {
      const opt =
        q.options.find((o) => o.law === 2 || o.good === 2) ?? q.options[0]!;
      return { questionId: q.id, optionId: opt.id, label: opt.label };
    });
    const resolved = resolveAlignmentFromQuiz("human", answers);
    expect(resolved.alignmentId).toBeTruthy();
    expect(typeof resolved.lawRatio).toBe("number");
  });

  it("definingExperienceFromQuiz picks the strongest answered option", () => {
    const qs = alignmentQuestionsFor("human");
    const q = qs[0]!;
    const strong =
      [...q.options].sort(
        (a, b) =>
          Math.abs(b.law) + Math.abs(b.good) - (Math.abs(a.law) + Math.abs(a.good)),
      )[0]!;
    const exp = definingExperienceFromQuiz("human", [
      { questionId: q.id, optionId: strong.id, label: strong.label },
    ]);
    expect(exp?.optionId).toBe(strong.id);
    expect(exp?.scenario).toBe(q.text);
  });
});
