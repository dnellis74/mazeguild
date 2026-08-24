import { describe, expect, it } from "vitest";
import { chooseAction } from "./tactics";
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
    className: string;
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
    ...over,
  };
}

const foes = [
  combatant({ id: "gob-low", className: "Monster", role: "dps", hp: 3, maxHp: 7 }),
  combatant({ id: "gob-high", className: "Monster", role: "dps", hp: 10, maxHp: 11 }),
];

describe("chooseAction", () => {
  it("tags a caster's attack with their assigned cantrip and keeps dps targeting", () => {
    const wizard = combatant({
      id: "wiz",
      className: "Wizard",
      role: "dps",
      cantrip: "Fire Bolt",
    });
    expect(chooseAction(wizard, [wizard], foes)).toEqual({
      type: "attack",
      targetId: "gob-low",
      ability: "Fire Bolt",
    });
  });

  it("leaves Barbarian and Paladin as plain weapon attacks", () => {
    const barbarian = combatant({
      id: "barb",
      className: "Barbarian",
      role: "tank",
    });
    const paladin = combatant({
      id: "pal",
      className: "Paladin",
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
      className: "Druid",
      role: "healer",
      cantrip: "Produce Flame",
      healSlots: 1,
    });
    const wounded = combatant({
      id: "ally",
      className: "Fighter",
      role: "tank",
      hp: 4,
      maxHp: 12,
    });
    expect(chooseAction(druid, [druid, wounded], foes)).toEqual({
      type: "heal",
      targetId: "ally",
    });
  });
});
