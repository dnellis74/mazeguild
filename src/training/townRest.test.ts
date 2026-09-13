import { describe, expect, it } from "vitest";
import { companionToCombatant } from "@/sim/adapter";
import { emptyEquipment } from "@/sim/loadout";
import type { Character } from "@/training/types";
import { hitDiceTotalFor, restoreAfterTownReturn } from "./townRest";

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

    const restored = restoreAfterTownReturn(wounded, 50);
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

    const restored = restoreAfterTownReturn(spent, spent.xp);
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
    const restored = restoreAfterTownReturn(barb, 0);
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
    const restored = restoreAfterTownReturn(mid, 900);
    expect(restored.hitDiceTotal).toBe(3);
    expect(restored.hitDiceRemaining).toBe(3);
  });
});
