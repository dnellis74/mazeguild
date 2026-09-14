import { describe, expect, it } from "vitest";
import { makeMonster } from "./adapter";
import { MONSTER_STATS } from "./encounters";
import { attackRollMode, applyDamage, resolveAttack } from "./rules";
import { createRng } from "./rng";
import type { CharacterEquipment } from "@/training/types";
import type { Combatant } from "./types";
import { DYING_DEFAULTS, HIT_DICE_DEFAULTS, TRAIT_DEFAULTS, WEAR_DEFAULTS } from "./dyingDefaults";

function fullEquipment(
  partial: Partial<CharacterEquipment> | undefined,
): CharacterEquipment {
  return {
    armor: partial?.armor ?? null,
    mainHand: partial?.mainHand ?? null,
    offHand: partial?.offHand ?? null,
    pack: partial?.pack ?? null,
  };
}

function spawn(type: keyof typeof MONSTER_STATS, id = "m1"): Combatant {
  const stats = MONSTER_STATS[type]!;
  return makeMonster({
    id,
    name: stats.name ?? type,
    hp: stats.hp,
    abilities: stats.abilities,
    equipment: fullEquipment(stats.equipment),
    features: stats.features,
    traits: stats.traits,
    xpValue: stats.xpValue,
    acOverride: stats.acOverride,
    naturalArmor: stats.naturalArmor,
    naturalWeapons: stats.naturalWeapons,
    damageVulnerabilities: stats.damageVulnerabilities,
    damageImmunities: stats.damageImmunities,
    conditionImmunities: stats.conditionImmunities,
    savingThrows: stats.savingThrows,
  });
}

function toHit(c: Combatant): number {
  if (c.weapon.attackBonus != null) return c.weapon.attackBonus;
  const dex = Math.floor((c.abilities.DEX - 10) / 2);
  const str = Math.floor((c.abilities.STR - 10) / 2);
  const abi = c.weapon.finesse || c.weapon.ranged ? Math.max(str, dex) : str;
  return abi + c.proficiencyBonus;
}

function avgDamage(c: Combatant): number {
  const die = c.weapon.damage;
  const dieAvg = (die.count * (die.sides + 1)) / 2;
  if (c.weapon.damageBonus != null) return dieAvg + c.weapon.damageBonus;
  const dex = Math.floor((c.abilities.DEX - 10) / 2);
  const str = Math.floor((c.abilities.STR - 10) / 2);
  const abi = c.weapon.finesse || c.weapon.ranged ? Math.max(str, dex) : str;
  return dieAvg + abi;
}

function dummyFoe(over: Partial<Combatant> = {}): Combatant {
  return {
    id: "foe",
    name: "Foe",
    kind: "pc",
    archetype: "Fighter",
    race: "Human",
    role: "tank",
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    proficiencyBonus: 2,
    ac: 10,
    maxHp: 20,
    hp: 20,
    alive: true,
    ...DYING_DEFAULTS,
    ...HIT_DICE_DEFAULTS,
    ...WEAR_DEFAULTS,
    ...TRAIT_DEFAULTS,
    weapon: {
      name: "Club",
      damage: { count: 1, sides: 4 },
      damageType: "bludgeoning",
      properties: [],
      finesse: false,
      ranged: false,
    },
    fightingStyles: [],
    archery: false,
    greatWeaponFighting: false,
    secondWindAvailable: false,
    secondWindLevel: 0,
    lucky: false,
    relentless: false,
    relentlessUsed: false,
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
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellSlots: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
    ...over,
  };
}

describe("milestone monster roster", () => {
  it.each([
    ["Kobold", 12, 5, 4, 4.5],
    ["Skeleton", 13, 13, 4, 5.5],
    ["Zombie", 8, 22, 3, 4.5],
    ["Wolf", 13, 11, 4, 7],
    ["Orc", 13, 15, 5, 9.5],
    ["Ghoul", 12, 22, 4, 7],
    ["GiantSpider", 14, 26, 5, 7.5],
  ] as const)(
    "%s matches AC, HP, to-hit, and average damage",
    (type, ac, hp, hit, dmg) => {
      const m = spawn(type);
      expect(m.ac).toBe(ac);
      expect(m.maxHp).toBe(hp);
      expect(m.hp).toBe(hp);
      expect(toHit(m)).toBe(hit);
      expect(avgDamage(m)).toBe(dmg);
    },
  );

  it("Skeleton takes double bludgeoning and normal piercing", () => {
    const sk = spawn("Skeleton");
    sk.hp = 13;
    const club = applyDamage(sk, 4, "bludgeoning");
    expect(club).toBe(8);
    expect(sk.hp).toBe(5);
    const pierce = applyDamage(sk, 4, "piercing");
    expect(pierce).toBe(4);
    expect(sk.hp).toBe(1);
  });

  it("Zombie Undead Fortitude can save to 1 HP on non-radiant non-crit", () => {
    const z = spawn("Zombie");
    z.hp = 3;
    // CON +3; d20=20 → save 23 vs DC 5+3=8
    const applied = applyDamage(z, 3, "slashing", createRng(0.99), false);
    expect(applied).toBe(3);
    expect(z.hp).toBe(1);
    expect(z.alive).toBe(true);
  });

  it("Zombie Undead Fortitude does not apply on radiant or crit", () => {
    const radiant = spawn("Zombie");
    radiant.hp = 3;
    applyDamage(radiant, 3, "radiant", createRng(0.99), false);
    expect(radiant.alive).toBe(false);
    expect(radiant.hp).toBe(0);

    const crit = spawn("Zombie");
    crit.hp = 3;
    applyDamage(crit, 3, "slashing", createRng(0.99), true);
    expect(crit.alive).toBe(false);
  });

  it("Pack Tactics: alone no advantage; with living ally advantage", () => {
    const lone = spawn("Kobold", "k1");
    const foe = dummyFoe({ ac: 99 });
    expect(
      attackRollMode(lone, foe, { packTacticsAlly: false }),
    ).toBe("none");
    expect(
      attackRollMode(lone, foe, { packTacticsAlly: true }),
    ).toBe("advantage");

    // resolveAttack path: ally flag flips advantage mode on the result
    const withAlly = resolveAttack(
      createRng(0.5),
      lone,
      foe,
      1,
      { packTacticsAlly: true },
    );
    expect(withAlly.advantageMode).toBe("advantage");
    const solo = resolveAttack(createRng(0.5), lone, foe, 0, {
      packTacticsAlly: false,
    });
    expect(solo.advantageMode).toBe("none");
  });

  it("same seed yields the same attack outcomes (determinism)", () => {
    const a = spawn("Orc", "o1");
    const b = spawn("Orc", "o2");
    const foeA = dummyFoe({ id: "f1", ac: 10, hp: 50, maxHp: 50 });
    const foeB = dummyFoe({ id: "f2", ac: 10, hp: 50, maxHp: 50 });
    const r1 = resolveAttack(createRng(42), a, foeA, 1);
    const r2 = resolveAttack(createRng(42), b, foeB, 1);
    expect(r1).toEqual(r2);
  });
});
