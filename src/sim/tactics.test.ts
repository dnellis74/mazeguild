import { describe, expect, it } from "vitest";
import { chooseAction, chooseBeforeDamageReaction, chooseBonusAction } from "./tactics";
import type { Combatant, Role, Weapon } from "./types";

const CLUB: Weapon = {
  name: "Club",
  damage: { count: 1, sides: 4 },
  damageType: "bludgeoning",
  properties: [],
  finesse: false,
  ranged: false,
};

function combatant(
  over: Partial<Combatant> & {
    id: string;
    archetype: string;
    role: Role;
  },
): Combatant {
  return {
    name: over.id,
    kind: "pc",
    race: "Human",
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    proficiencyBonus: 2,
    ac: 10,
    maxHp: 10,
    hp: 10,
    alive: true,
    weapon: CLUB,
    fightingStyles: [],
    archery: false,
    greatWeaponFighting: false,
    secondWindAvailable: false,
    secondWindLevel: 0,
    lucky: false,
    relentless: false,
    relentlessUsed: false,
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellSlots: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
    reactionUsed: false,
    sneakAttackUsedThisTurn: false,
    tempAcBonus: 0,
    condition: null,
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    raging: false,
    ragesRemaining: 0,
    rageDamage: 0,
    rageMaintained: false,
    rageExpiresRound: null,
    concentratingOn: null,
    rollModifiers: [],
    ...over,
  };
}

const foes = [
  combatant({ id: "gob-low", archetype: "Monster", role: "dps", hp: 3, maxHp: 7 }),
  combatant({ id: "gob-high", archetype: "Monster", role: "dps", hp: 10, maxHp: 11 }),
];

describe("chooseAction", () => {
  it("tags a caster's attack with their assigned cantrip and keeps dps targeting", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Ray of Frost",
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Ray of Frost",
    });
  });

  it("prefers a leveled attack spell over a cantrip when slots remain", () => {
    const cleric = combatant({
      id: "clr",
      archetype: "Cleric",
      role: "dps",
      attackSpell: "Guiding Bolt",
      spellSlots: 1,
      cantrip: "Sacred Flame",
    });
    expect(chooseAction(cleric, [cleric], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Guiding Bolt",
    });
  });

  it("leaves Barbarian and Paladin as plain weapon attacks", () => {
    const barbarian = combatant({
      id: "barb",
      archetype: "Barbarian",
      role: "tank",
    });
    const paladin = combatant({
      id: "pal",
      archetype: "Paladin",
      role: "tank",
    });
    expect(chooseAction(barbarian, [barbarian], foes)).toEqual({
      type: "attack",
      targetId: "gob-high",
    });
    expect(chooseAction(paladin, [paladin], foes)).toEqual({
      type: "attack",
      targetId: "gob-high",
    });
  });

  it("still heals a wounded ally before attacking, even with a cantrip assigned", () => {
    const druid = combatant({
      id: "dru",
      archetype: "Druid",
      role: "healer",
      cantrip: "Produce Flame",
      healSlots: 1,
    });
    const wounded = combatant({
      id: "ally",
      archetype: "Fighter",
      role: "tank",
      hp: 4,
      maxHp: 12,
    });
    expect(chooseAction(druid, [druid, wounded], foes)).toEqual({
      type: "heal",
      targetId: "ally",
      ability: "Cure Wounds",
    });
  });

  it("chooseBonusAction casts Healing Word on a wounded ally", () => {
    const cleric = combatant({
      id: "clr",
      archetype: "Cleric",
      role: "healer",
      bonusHealSpell: "Healing Word",
      spellSlots: 1,
    });
    const wounded = combatant({
      id: "ally",
      archetype: "Fighter",
      role: "tank",
      hp: 4,
      maxHp: 12,
    });
    expect(chooseBonusAction(cleric, [cleric, wounded], foes)).toEqual({
      type: "heal",
      targetId: "ally",
      ability: "Healing Word",
    });
  });

  it("chooseBonusAction enters Rage for a Barbarian with living foes", () => {
    const barb = combatant({
      id: "barb",
      archetype: "Barbarian",
      role: "tank",
      ragesRemaining: 2,
      raging: false,
    });
    expect(chooseBonusAction(barb, [barb], foes)).toEqual({
      type: "rage",
      mode: "enter",
    });
    barb.raging = true;
    expect(chooseBonusAction(barb, [barb], foes)).toEqual({ type: "none" });
  });

  it("chooseBonusAction uses Second Wind when wounded", () => {
    const fighter = combatant({
      id: "ftr",
      archetype: "Fighter",
      role: "tank",
      secondWindAvailable: true,
      secondWindLevel: 1,
      hp: 5,
      maxHp: 12,
    });
    expect(chooseBonusAction(fighter, [fighter], foes)).toEqual({
      type: "second_wind",
    });
    fighter.hp = 12;
    expect(chooseBonusAction(fighter, [fighter], foes)).toEqual({
      type: "none",
    });
  });

  it("chooseBonusAction is none without Healing Word or wounded allies", () => {
    const cleric = combatant({
      id: "clr",
      archetype: "Cleric",
      role: "healer",
      bonusHealSpell: "Healing Word",
      spellSlots: 1,
      hp: 10,
      maxHp: 10,
    });
    expect(chooseBonusAction(cleric, [cleric], foes)).toEqual({ type: "none" });
    const noHw = combatant({
      id: "clr2",
      archetype: "Cleric",
      role: "healer",
      healSpell: "Cure Wounds",
      healSlots: 1,
      spellSlots: 1,
    });
    const wounded = combatant({
      id: "ally",
      archetype: "Fighter",
      role: "tank",
      hp: 4,
      maxHp: 12,
    });
    expect(chooseBonusAction(noHw, [noHw, wounded], foes)).toEqual({
      type: "none",
    });
  });

  it("prefers Magic Missile over cantrip when slots remain", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      spell: "Magic Missile",
      spellSlots: 2,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Magic Missile",
    });
  });

  it("falls back to cantrip when spell slots are exhausted", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      spell: "Magic Missile",
      spellSlots: 0,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("never chooses Magic Missile if the spell was not learned", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      spellSlots: 2,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("prefers Sleep over cantrip/MM when ≥2 living foes and slots remain", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      spell: "Magic Missile",
      controlSpell: "Sleep",
      spellSlots: 2,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "control",
      ability: "Sleep",
    });
  });

  it("casts Color Spray under the same ≥2-foe policy", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      controlSpell: "Color Spray",
      spellSlots: 1,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "control",
      ability: "Color Spray",
    });
  });

  it("casts Burning Hands when ≥2 foes and no control spell", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      saveSpell: "Burning Hands",
      spellSlots: 1,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "save",
      ability: "Burning Hands",
    });
  });

  it("does not cast Burning Hands against a single foe", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      saveSpell: "Burning Hands",
      spellSlots: 1,
    });
    expect(chooseAction(wizard, [wizard], [foes[0]!])).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("never casts Burning Hands with 0 spell slots", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      saveSpell: "Burning Hands",
      spellSlots: 0,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("does not cast Sleep against a single foe", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      controlSpell: "Sleep",
      spellSlots: 2,
    });
    expect(chooseAction(wizard, [wizard], [foes[0]!])).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("never casts Sleep if the spell was not learned", () => {
    const wizard = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
      spellSlots: 2,
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("casts Bless when ≥2 allies, slots remain, and not concentrating", () => {
    const cleric = combatant({
      id: "clr",
      archetype: "Cleric",
      role: "healer",
      buffSpell: "Bless",
      spellSlots: 1,
      cantrip: "Sacred Flame",
    });
    const ally = combatant({
      id: "ally",
      archetype: "Fighter",
      role: "tank",
    });
    expect(chooseAction(cleric, [cleric, ally], foes)).toEqual({
      type: "buff",
      ability: "Bless",
    });
  });

  it("skips Bless while already concentrating", () => {
    const cleric = combatant({
      id: "clr",
      archetype: "Cleric",
      role: "healer",
      buffSpell: "Bless",
      spellSlots: 1,
      cantrip: "Sacred Flame",
      concentratingOn: {
        spellName: "Bless",
        startedRound: 1,
        onEnd: () => {},
      },
    });
    const ally = combatant({
      id: "ally",
      archetype: "Fighter",
      role: "tank",
    });
    expect(chooseAction(cleric, [cleric, ally], foes)).toEqual({
      type: "attack",
      targetId: "gob-high",
      ability: "Sacred Flame",
    });
  });
});

describe("chooseBeforeDamageReaction (Shield)", () => {
  const baseCtx = { total: 12, crit: false, ac: 10 };

  it("casts Shield when +5 would turn a hit into a miss", () => {
    const wiz = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      reactionSpell: "Shield",
      spellSlots: 1,
    });
    expect(chooseBeforeDamageReaction(wiz, baseCtx)).toEqual({
      type: "reaction",
      ability: "Shield",
    });
  });

  it("does not cast when the attack still hits with +5", () => {
    const wiz = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      reactionSpell: "Shield",
      spellSlots: 1,
    });
    expect(
      chooseBeforeDamageReaction(wiz, { total: 16, crit: false, ac: 10 }),
    ).toEqual({ type: "none" });
  });

  it("does not cast on a critical hit", () => {
    const wiz = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      reactionSpell: "Shield",
      spellSlots: 1,
    });
    expect(
      chooseBeforeDamageReaction(wiz, { total: 25, crit: true, ac: 10 }),
    ).toEqual({ type: "none" });
  });

  it("does not cast with 0 spell slots", () => {
    const wiz = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      reactionSpell: "Shield",
      spellSlots: 0,
    });
    expect(chooseBeforeDamageReaction(wiz, baseCtx)).toEqual({ type: "none" });
  });

  it("does not cast when Shield was never learned", () => {
    const wiz = combatant({
      id: "wiz",
      archetype: "Wizard",
      role: "dps",
      spellSlots: 2,
    });
    expect(chooseBeforeDamageReaction(wiz, baseCtx)).toEqual({ type: "none" });
  });
});
