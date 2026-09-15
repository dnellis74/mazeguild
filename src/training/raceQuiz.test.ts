import { describe, expect, it } from "vitest";
import {
  computeRaceTotals,
  computeSuggestion,
  normalizeRaceWeightId,
  type RaceQuizQuestion,
} from "./raceQuiz";

const RACE_IDS = ["human", "dwarf", "half-orc", "half-elf"] as const;

const QUESTIONS: RaceQuizQuestion[] = [
  {
    text: "Q1",
    options: [
      { label: "A", w: { dwarf: 2, halforc: 1 } },
      { label: "B", w: { halfelf: 2 } },
    ],
  },
  {
    text: "Q2",
    options: [
      { label: "C", w: { dwarf: 2 } },
      { label: "D", w: { human: 1 } },
    ],
  },
];

describe("normalizeRaceWeightId", () => {
  it("expands compacted half-race keys", () => {
    expect(normalizeRaceWeightId("halforc")).toBe("half-orc");
    expect(normalizeRaceWeightId("halfelf")).toBe("half-elf");
    expect(normalizeRaceWeightId("dwarf")).toBe("dwarf");
  });
});

describe("computeRaceTotals / computeSuggestion", () => {
  it("maps compacted weight keys onto race ids", () => {
    const totals = computeRaceTotals(RACE_IDS, QUESTIONS, [
      { question: "Q1", optionIndex: 0, optionLabel: "A" },
      null,
    ]);
    expect(totals["half-orc"]).toBe(1);
    expect(totals.dwarf).toBe(2);
  });

  it("suggests the clear winner", () => {
    const id = computeSuggestion(RACE_IDS, QUESTIONS, [
      { question: "Q1", optionIndex: 0, optionLabel: "A" },
      { question: "Q2", optionIndex: 0, optionLabel: "C" },
    ]);
    expect(id).toBe("dwarf");
  });

  it("falls back to human when totals are empty", () => {
    expect(computeSuggestion(RACE_IDS, QUESTIONS, [])).toBe("human");
  });

  it("falls back to human on a near-tie", () => {
    const id = computeSuggestion(RACE_IDS, QUESTIONS, [
      { question: "Q1", optionIndex: 0, optionLabel: "A" },
      null,
    ]);
    // dwarf 2, half-orc 1 — gap is 1, which is not < 1, so dwarf wins.
    expect(id).toBe("dwarf");
  });
});
