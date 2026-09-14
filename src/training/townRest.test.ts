import { describe, expect, it } from "vitest";
import { companionToCombatant, maxHpForLevel } from "@/sim/adapter";
import { emptyEquipment } from "@/sim/loadout";
import { abilityMod } from "@/sim/rules";
import type { Character } from "@/training/types";
import {
  FEATURE_POINTS_PER_LEVEL,
  hitDiceTotalFor,
  restoreAfterTownReturn,
} from "./townRest";

function baseCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: "c1",
    name: "Aldric",
    raceId: "human",
    alignment: { alignmentId: "lg" },
    featurePoints: 0,
    features: [],
    cantrips: [],
    spells: [],
    abilityScores: {
      STR: 15,
      DEX: 14,
      CON: 13,
      INT: 10,
      WIS: 12,
      CHA: 8,
    },
    abilityScoresAssigned: true,
    originStory: null,
    unlocked: { areas: {}, buildings: {}, rooms: {} },
    activeJob: null,
    xp: 0,
    hp: null,
    hitDiceTotal: 1,
    hitDiceRemaining: 1,
    equipment: emptyEquipment(),
    ...overrides,
  };
}

describe("restoreAfterTownReturn", () => {
  it("restores full HP and Hit Dice after 0 HP / 0 Hit Dice (dying survivor)", () => {
    const wounded = baseCharacter({
      features: [
        {
          id: "fighter-second-wind",
          feature: ["Second Wind"],
          archetype: "Fighter",
        },
      ],
      hp: 0,
      hitDiceTotal: 1,
      hitDiceRemaining: 0,
      xp: 0,
    });

    const { character: restored, levelUp } = restoreAfterTownReturn(wounded, 50);
    expect(levelUp).toBeNull();
    expect(restored.hp).toBeNull();
    expect(restored.xp).toBe(50);
    expect(restored.hitDiceTotal).toBe(hitDiceTotalFor(restored));
    expect(restored.hitDiceRemaining).toBe(restored.hitDiceTotal);
    expect(restored.hitDiceRemaining).toBeGreaterThan(0);

    const combatant = companionToCombatant(restored, 0);
    expect(combatant.hp).toBe(combatant.maxHp);
    expect(combatant.alive).toBe(true);
    expect(combatant.secondWindAvailable).toBe(true);
  });

  it("restores full spell slots for casters on the next run build", () => {
    const spent = baseCharacter({
      name: "Mira",
      raceId: "dwarf",
      features: [
        {
          id: "cleric-domain",
          feature: ["Disciple of Life"],
          archetype: "Cleric",
        },
      ],
      spells: [
        {
          id: "cure-wounds",
          name: "Cure Wounds",
          archetype: "Cleric",
          level: 1,
        },
      ],
      abilityScores: {
        STR: 12,
        DEX: 10,
        CON: 14,
        INT: 10,
        WIS: 15,
        CHA: 11,
      },
      hp: 1,
      hitDiceRemaining: 0,
      hitDiceTotal: 1,
    });

    const { character: restored } = restoreAfterTownReturn(spent, spent.xp);
    const combatant = companionToCombatant(restored, 0);
    expect(combatant.spellSlots).toBe(2);
    expect(combatant.hp).toBe(combatant.maxHp);
    expect(restored.hitDiceRemaining).toBe(restored.hitDiceTotal);
  });

  it("restores Barbarian Rage uses via fresh combatant build (per-run, not half long-rest)", () => {
    const barb = baseCharacter({
      features: [
        {
          id: "barb-rage",
          feature: ["Rage", "Unarmored Defense"],
          archetype: "Barbarian",
        },
      ],
      hp: 3,
      hitDiceRemaining: 0,
    });
    const { character: restored } = restoreAfterTownReturn(barb, 0);
    const combatant = companionToCombatant(restored, 0);
    expect(combatant.ragesRemaining).toBe(2);
    expect(combatant.raging).toBe(false);
    expect(combatant.condition).toBeNull();
    expect(combatant.concentratingOn).toBeNull();
  });

  it("uses full Hit Dice restore, not SRD half-round-down long rest", () => {
    // Level 3 → 3 Hit Dice; half round-down would be 1 — town gives all 3.
    const mid = baseCharacter({
      xp: 900,
      hitDiceTotal: 3,
      hitDiceRemaining: 0,
      hp: 2,
    });
    const { character: restored } = restoreAfterTownReturn(mid, 900);
    expect(restored.hitDiceTotal).toBe(3);
    expect(restored.hitDiceRemaining).toBe(3);
  });

  it("on level-up grants a Hit Die and two feature points per level", () => {
    const ch = baseCharacter({
      featurePoints: 1,
      xp: 0,
      features: [
        {
          id: "fighter-second-wind",
          feature: ["Second Wind"],
          archetype: "Fighter",
        },
      ],
    });
    const { character, levelUp } = restoreAfterTownReturn(ch, 300);
    expect(levelUp).toEqual({
      fromLevel: 1,
      toLevel: 2,
      levelsGained: 1,
      featurePointsGranted: FEATURE_POINTS_PER_LEVEL,
    });
    expect(character.hitDiceTotal).toBe(2);
    expect(character.hitDiceRemaining).toBe(2);
    expect(character.featurePoints).toBe(1 + FEATURE_POINTS_PER_LEVEL);

    const combatant = companionToCombatant(character, 0);
    const con = abilityMod(13);
    expect(combatant.maxHp).toBe(maxHpForLevel(10, con, 2)); // Fighter d10
  });

  it("grants stacked Hit Dice and feature points when skipping multiple levels", () => {
    const ch = baseCharacter({ featurePoints: 0, xp: 0 });
    const { character, levelUp } = restoreAfterTownReturn(ch, 900); // → 3
    expect(levelUp?.levelsGained).toBe(2);
    expect(levelUp?.featurePointsGranted).toBe(2 * FEATURE_POINTS_PER_LEVEL);
    expect(character.hitDiceTotal).toBe(3);
    expect(character.featurePoints).toBe(4);
  });

  it("does not grant feature points when XP rises within the same level", () => {
    const ch = baseCharacter({ featurePoints: 0, xp: 0 });
    const { character, levelUp } = restoreAfterTownReturn(ch, 299);
    expect(levelUp).toBeNull();
    expect(character.featurePoints).toBe(0);
    expect(character.hitDiceTotal).toBe(1);
  });
});
