import { describe, expect, it } from "vitest";
import { characterLabel } from "./labels";
import type { Character } from "@/training/types";

function stub(partial: Partial<Character>): Character {
  return {
    id: "c1",
    displayName: "Companion",
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
    ...partial,
  };
}

describe("characterLabel", () => {
  it("prefers displayName", () => {
    expect(characterLabel(stub({ displayName: "  Aldric  " }))).toBe("Aldric");
  });

  it("falls back when name is blank", () => {
    expect(characterLabel(stub({ displayName: "", raceId: "elf" }))).toBe(
      "elf companion",
    );
  });
});
