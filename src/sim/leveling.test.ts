import { describe, expect, it } from "vitest";
import { applyProgression, hitDieSides, levelForXp } from "./leveling";
import { createRng } from "./rng";
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

describe("hitDieSides", () => {
  it("reads the class hit die from leveling data", () => {
    expect(hitDieSides("Fighter")).toBe(10);
    expect(hitDieSides("Barbarian")).toBe(12);
    expect(hitDieSides("Wizard")).toBe(6);
  });
});

describe("applyProgression", () => {
  it("rolls 1d10 + CON for a fighter level, at least 1 hp", () => {
    const next = applyProgression(fighter, 300, createRng(1));
    expect(next.meta?.level).toBe(2);
    expect(next.xp).toBe(300);
    expect(next.hit_point_rolls).toHaveLength(1);
    const roll = next.hit_point_rolls![0]!;
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(10);
    expect(next.hit_points.value).toBe(12 + Math.max(1, roll + 2));
    expect(next.hit_points.hit_die).toBe("2d10");
    expect(next.class_features?.length).toBeGreaterThan(0);
  });

  it("does not reroll existing levels", () => {
    const first = applyProgression(fighter, 300, createRng(1));
    const again = applyProgression(first, 300, createRng(99));
    expect(again.hit_points.value).toBe(first.hit_points.value);
    expect(again.hit_point_rolls).toEqual(first.hit_point_rolls);
  });
});
