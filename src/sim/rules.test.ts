import { describe, expect, it } from "vitest";
import { companionToCombatant } from "./adapter";
import { pickLearnedAttackCantrip } from "./cantrips";
import { createRng } from "./rng";
import { resolveAttack } from "./rules";
import type { Character } from "@/training/types";
import type { Combatant, Weapon } from "./types";

const CLUB: Weapon = {
  name: "Club",
  damage: { count: 1, sides: 4 },
  damageType: "bludgeoning",
  properties: [],
  finesse: false,
  ranged: false,
};

const DAGGER: Weapon = {
  name: "Dagger",
  damage: { count: 1, sides: 4 },
  damageType: "piercing",
  properties: ["finesse"],
  finesse: true,
  ranged: false,
};

function basePc(over: Partial<Combatant> = {}): Combatant {
  return {
    id: "pc",
    name: "Test",
    kind: "pc",
    archetype: "Wizard",
    race: "Human",
    role: "dps",
    abilities: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    proficiencyBonus: 2,
    ac: 12,
    maxHp: 8,
    hp: 8,
    alive: true,
    weapon: CLUB,
    lucky: false,
    relentless: false,
    relentlessUsed: false,
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellMod: 3,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
    ...over,
  };
}

function foe(ac = 10): Combatant {
  return {
    id: "gob",
    name: "Goblin",
    kind: "monster",
    archetype: "Monster",
    race: "Monster",
    role: "dps",
    abilities: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    proficiencyBonus: 2,
    ac,
    maxHp: 7,
    hp: 7,
    alive: true,
    weapon: CLUB,
    lucky: false,
    relentless: false,
    relentlessUsed: false,
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
  };
}

/** Returns successive values from `seq`, then 0. */
function seqRng(seq: number[]) {
  let i = 0;
  return () => (i < seq.length ? seq[i++]! : 0);
}

function wizardCharacter(cantrips: Character["cantrips"]): Character {
  return {
    id: "wiz-1",
    name: "Elowen",
    raceId: "elf",
    alignment: { alignmentId: "nn" },
    featurePoints: 0,
    features: [
      {
        id: "wizard-arcane-recovery",
        feature: ["Arcane Recovery"],
        archetype: "Wizard",
      },
    ],
    cantrips,
    spells: [],
    abilityScores: {
      STR: 8,
      DEX: 14,
      CON: 12,
      INT: 16,
      WIS: 12,
      CHA: 10,
    },
    abilityScoresAssigned: true,
    originStory: null,
    unlocked: { areas: {}, buildings: {}, rooms: {} },
    activeJob: null,
    xp: 0,
  };
}

describe("pickLearnedAttackCantrip", () => {
  it("uses a learned non-default attack cantrip", () => {
    expect(
      pickLearnedAttackCantrip([
        { name: "Light" },
        { name: "Ray of Frost" },
        { name: "Mage Hand" },
      ]),
    ).toBe("Ray of Frost");
  });

  it("returns undefined when no attack cantrips are learned", () => {
    expect(
      pickLearnedAttackCantrip([
        { name: "Light" },
        { name: "Mage Hand" },
        { name: "Sacred Flame" },
      ]),
    ).toBeUndefined();
  });

  it("picks among multiple attack cantrips with the seeded rng", () => {
    const learned = [
      { name: "Fire Bolt" },
      { name: "Ray of Frost" },
      { name: "Shocking Grasp" },
    ];
    expect(pickLearnedAttackCantrip(learned, () => 0)).toBe("Fire Bolt");
    expect(pickLearnedAttackCantrip(learned, () => 0.999)).toBe(
      "Shocking Grasp",
    );
  });
});

describe("companionToCombatant cantrips", () => {
  it("assigns Ray of Frost when learned, not a class default Fire Bolt", () => {
    const c = companionToCombatant(
      wizardCharacter([
        { id: "1", name: "Ray of Frost", archetype: "Wizard" },
        { id: "2", name: "Light", archetype: "Wizard" },
      ]),
      0,
      createRng(1),
    );
    expect(c.cantrip).toBe("Ray of Frost");
    expect(c.spellMod).toBe(3);
  });

  it("leaves cantrip unset when only utility cantrips are known", () => {
    const c = companionToCombatant(
      wizardCharacter([
        { id: "1", name: "Mage Hand", archetype: "Wizard" },
        { id: "2", name: "Light", archetype: "Wizard" },
      ]),
      0,
      createRng(1),
    );
    expect(c.cantrip).toBeUndefined();
  });
});

describe("resolveAttack cantrips", () => {
  it("rolls Ray of Frost d8 with spell attack bonus, not club d4 + STR", () => {
    const attacker = basePc({ cantrip: "Ray of Frost", weapon: CLUB });
    const target = foe(10);
    // crit d20=20, then 2× d8 forced to 4 each → damage 8; total 20+3+2
    const result = resolveAttack(seqRng([0.95, 0.4, 0.4]), attacker, target, 1);
    expect(result.hit).toBe(true);
    expect(result.crit).toBe(true);
    expect(result.damage).toBe(8);
    expect(result.total).toBe(25);
  });

  it("uses cantrip d8 sides on a normal hit (not weapon d4)", () => {
    const attacker = basePc({ cantrip: "Ray of Frost", weapon: CLUB });
    const target = foe(5);
    // d20=10, damage die=7
    const result = resolveAttack(seqRng([0.45, 0.8]), attacker, target, 0);
    expect(result.hit).toBe(true);
    expect(result.crit).toBe(false);
    expect(result.damage).toBe(7);
  });

  it("does not add sneak attack dice on a cantrip attack", () => {
    const attacker = basePc({
      cantrip: "Fire Bolt",
      sneakAttackDice: 1,
      weapon: DAGGER,
    });
    const target = foe(5);
    // d20=10, Fire Bolt 1d10=6 — would be 6+1d6 if sneak wrongly applied
    const result = resolveAttack(seqRng([0.45, 0.55]), attacker, target, 2);
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(6);
  });

  it("weapon attacks still use weapon dice and ability mod when no cantrip", () => {
    const attacker = basePc({
      cantrip: undefined,
      weapon: CLUB,
      abilities: { STR: 15, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      spellMod: 0,
    });
    const target = foe(5);
    // d20=10, d4=3 → damage 3+2 STR
    const result = resolveAttack(seqRng([0.45, 0.5]), attacker, target, 0);
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(5);
    expect(result.total).toBe(14);
  });
});
