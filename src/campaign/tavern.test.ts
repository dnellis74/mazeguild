import { describe, expect, it } from "vitest";
import {
  applyTavernReturn,
  characterLabel,
  sortPatrons,
} from "./tavern";
import type { PartySnapshot, SrdCharacter } from "@/sim/types";

const base: SrdCharacter = {
  name: "Aldric",
  class: "Fighter",
  race: "Human",
  ability_scores: {
    STR: { score: 16, modifier: "+3" },
    DEX: { score: 14, modifier: "+2" },
    CON: { score: 14, modifier: "+2" },
    INT: { score: 10, modifier: "+0" },
    WIS: { score: 12, modifier: "+1" },
    CHA: { score: 8, modifier: "-1" },
  },
  proficiency_bonus: "+2",
  hit_points: { value: 12, hit_die: "1d10" },
  armor_class: { value: 16 },
  meta: { level: 1 },
  xp: 0,
};

const party: PartySnapshot[] = [
  {
    name: "Aldric",
    class: "Fighter",
    race: "Human",
    hp: 0,
    maxHp: 12,
    ac: 16,
    xp: 300,
  },
];

describe("sortPatrons", () => {
  it("sorts patrons alphabetically by name", () => {
    const patrons = [
      { ...base, name: "Zara" },
      { ...base, name: "Aldric" },
      { ...base, name: "Mira" },
    ];
    expect(sortPatrons(patrons).map(characterLabel)).toEqual([
      "Aldric",
      "Mira",
      "Zara",
    ]);
  });
});

describe("applyTavernReturn", () => {
  it("keeps wiped party members in the roster", () => {
    const patrons = [base, { ...base, name: "Bryn" }];
    const next = applyTavernReturn(patrons, ["Aldric", "Bryn"], party, true);
    expect(next).toHaveLength(2);
    expect(next.map(characterLabel)).toEqual(["Aldric", "Bryn"]);
  });

  it("applies xp and full healing to survivors", () => {
    const patrons = [base, { ...base, name: "Bryn" }];
    const next = applyTavernReturn(patrons, ["Aldric"], party, false);
    expect(next[0]?.xp).toBe(300);
    expect(next[0]?.meta?.level).toBe(2);
    expect(next[0]?.hit_points.value).toBeGreaterThan(12);
    expect(next[1]).toEqual(patrons[1]);
  });
});
