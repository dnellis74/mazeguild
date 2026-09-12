import { describe, expect, it } from "vitest";
import { characterLabel } from "./labels";
import type { SrdCharacter } from "@/sim/types";

function stub(partial: Partial<SrdCharacter>): SrdCharacter {
  return {
    race: "Human",
    class: "Fighter",
    hit_points: { value: 10 },
    armor_class: { value: 10 },
    ability_scores: {},
    ...partial,
  } as SrdCharacter;
}

describe("characterLabel", () => {
  it("prefers a trimmed name", () => {
    expect(characterLabel(stub({ name: "  Aldric  ", race: "Human", class: "Fighter" }))).toBe(
      "Aldric",
    );
  });

  it("falls back to race and class", () => {
    expect(characterLabel(stub({ name: "", race: "Elf", class: "Wizard" }))).toBe("Elf Wizard");
  });
});
