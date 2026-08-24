import { describe, expect, it } from "vitest";
import {
  applyProgression,
  computeMaxHp,
  levelForXp,
} from "./leveling";
import type { SrdCharacter } from "./types";

const fighter: SrdCharacter = {
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

describe("levelForXp", () => {
  it("returns level 1 at 0 xp", () => {
    expect(levelForXp("Fighter", 0)).toBe(1);
  });

  it("returns level 2 at 300 xp", () => {
    expect(levelForXp("Fighter", 300)).toBe(2);
  });

  it("stays at level 1 below the next threshold", () => {
    expect(levelForXp("Fighter", 299)).toBe(1);
  });
});

describe("computeMaxHp", () => {
  it("increases with level", () => {
    expect(computeMaxHp(fighter, 2)).toBeGreaterThan(computeMaxHp(fighter, 1));
  });
});

describe("applyProgression", () => {
  it("sets full hp and level from xp", () => {
    const next = applyProgression(fighter, 300);
    expect(next.meta?.level).toBe(2);
    expect(next.xp).toBe(300);
    expect(next.hit_points.value).toBe(computeMaxHp(fighter, 2));
    expect(next.class_features?.length).toBeGreaterThan(0);
  });
});
