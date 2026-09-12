import { describe, expect, it } from "vitest";
import { characterLabel } from "./labels";
import type { Character } from "@/training/types";

function stub(partial: Partial<Character>): Character {
  return {
    id: "c1",
    name: "Companion",
    raceId: "human",
    alignment: { alignmentId: "lg" },
    featurePoints: 2,
    features: [],
    cantrips: [],
    spells: [],
    abilityScores: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10,
    },
    abilityScoresAssigned: true,
    unlocked: { areas: {}, buildings: {}, rooms: {} },
    activeJob: null,
    xp: 0,
    ...partial,
  };
}

describe("characterLabel", () => {
  it("prefers name", () => {
    expect(characterLabel(stub({ name: "  Aldric  " }))).toBe("Aldric");
  });

  it("falls back when name is blank", () => {
    expect(characterLabel(stub({ name: "", raceId: "elf" }))).toBe(
      "elf companion",
    );
  });
});
