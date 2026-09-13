import { describe, expect, it } from "vitest";
import { companionToCombatant } from "./adapter";
import { pickLearnedAttackCantrip } from "./cantrips";
import { createRng, diceRerollLow } from "./rng";
import {
  resolveAttack,
  resolveAutoSpell,
  resolveHpPool,
  applyDamage,
  rollD20,
  resolveAdvantageMode,
  attackRollMode,
  resolveSave,
  spellSaveDC,
  rollSpellDamage,
  modifyDamageByTraits,
  beginRage,
  endRage,
  setCondition,
  clearCondition,
  expireConditionIfDue,
  hasCondition,
  resolveCureWounds,
  tickRageAtTurnStart,
  markRageAttack,
} from "./rules";
import {
  getSpell,
  pickLearnedAttackSpell,
  pickLearnedBonusHealSpell,
  pickLearnedControlSpell,
  pickLearnedHealSpell,
  pickLearnedSaveSpell,
} from "./spells";
import { rageDamageForLevel, ragesForLevel } from "./leveling";
import type { Character } from "@/training/types";
import type { Combatant, Weapon } from "./types";
import { DYING_DEFAULTS } from "./dyingDefaults";

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
    ...DYING_DEFAULTS,
    weapon: CLUB,
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
    ...DYING_DEFAULTS,
    weapon: CLUB,
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
  };
}

/** Returns successive values from `seq`, then 0. */
function seqRng(seq: number[]) {
  let i = 0;
  return () => (i < seq.length ? seq[i++]! : 0);
}

function wizardCharacter(
  cantrips: Character["cantrips"],
  spells: Character["spells"] = [],
): Character {
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
    spells,
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

function archetypeCharacter(
  archetype: string,
  opts: {
    features?: string[];
    abilityScores?: Partial<Record<import("@/lib/abilities").Ability, number>>;
  } = {},
): Character {
  const features = opts.features ?? ["Placeholder"];
  return {
    id: `${archetype.toLowerCase()}-test`,
    name: archetype,
    raceId: "human",
    alignment: { alignmentId: "ng" },
    featurePoints: 0,
    features: [
      {
        id: "class-feature",
        feature: features,
        archetype,
      },
    ],
    cantrips: [],
    spells: [],
    abilityScores: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10,
      ...opts.abilityScores,
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

  it("assigns Shield as reactionSpell only when learned", () => {
    const withShield = companionToCombatant(
      wizardCharacter(
        [{ id: "1", name: "Fire Bolt", archetype: "Wizard" }],
        [{ id: "sh", name: "Shield", archetype: "Wizard", level: 1 }],
      ),
      0,
      createRng(1),
    );
    expect(withShield.reactionSpell).toBe("Shield");

    const without = companionToCombatant(
      wizardCharacter([{ id: "1", name: "Fire Bolt", archetype: "Wizard" }], []),
      0,
      createRng(1),
    );
    expect(without.reactionSpell).toBeUndefined();
  });
});

describe("companionToCombatant armor", () => {
  it("Fighter: inventory chain mail (16) + shield (2), no DEX", () => {
    const c = companionToCombatant(
      archetypeCharacter("Fighter", {
        abilityScores: { DEX: 18, STR: 16, CON: 14 },
      }),
      0,
    );
    expect(c.ac).toBe(18);
    expect(c.weapon.name).toBe("Longsword");
  });

  it("Fighter with Defense: +1 on top of armor total", () => {
    const withDef = companionToCombatant(
      archetypeCharacter("Fighter", {
        features: ["Defense"],
        abilityScores: { DEX: 18 },
      }),
      0,
    );
    const without = companionToCombatant(
      archetypeCharacter("Fighter", {
        features: ["Dueling"],
        abilityScores: { DEX: 18 },
      }),
      0,
    );
    expect(withDef.ac).toBe(19);
    expect(without.ac).toBe(18);
  });

  it("Archery does not swap inventory weapon or drop shield", () => {
    const c = companionToCombatant(
      archetypeCharacter("Fighter", {
        features: ["Archery"],
        abilityScores: { DEX: 16 },
      }),
      0,
    );
    expect(c.archery).toBe(true);
    expect(c.weapon.name).toBe("Longsword");
    expect(c.ac).toBe(18); // chain mail + shield from inventory
  });

  it("Great Weapon Fighting does not swap inventory weapon or drop shield", () => {
    const c = companionToCombatant(
      archetypeCharacter("Fighter", {
        features: ["Great Weapon Fighting"],
      }),
      0,
    );
    expect(c.greatWeaponFighting).toBe(true);
    expect(c.weapon.name).toBe("Longsword");
    expect(c.ac).toBe(18);
  });

  it("Rogue: inventory leather (11) + full DEX mod", () => {
    const c = companionToCombatant(
      archetypeCharacter("Rogue", {
        features: ["Sneak Attack"],
        abilityScores: { DEX: 16 },
      }),
      0,
    );
    expect(c.ac).toBe(14);
    expect(c.weapon.name).toBe("Rapier");
  });

  it("Cleric: inventory scale mail + DEX capped at +2 + shield from item grant", () => {
    const c = companionToCombatant(
      archetypeCharacter("Cleric", {
        features: ["Disciple of Life"],
        abilityScores: { DEX: 18, WIS: 16 },
      }),
      0,
    );
    expect(c.ac).toBe(18);
    expect(c.weapon.name).toBe("Mace");
  });

  it("Barbarian: Unarmored Defense unchanged (ignores armor slot)", () => {
    const c = companionToCombatant(
      archetypeCharacter("Barbarian", {
        features: ["Rage"],
        abilityScores: { DEX: 14, CON: 14 },
      }),
      0,
    );
    expect(c.ac).toBe(14);
  });

  it("Wizard: 10 + DEX when inventory has no armor", () => {
    const c = companionToCombatant(
      wizardCharacter([{ id: "1", name: "Fire Bolt", archetype: "Wizard" }]),
      0,
    );
    expect(c.ac).toBe(12);
  });
});

describe("resolveAttack temp AC", () => {
  it("uses tempAcBonus when checking hit", () => {
    const attacker = basePc({
      cantrip: undefined,
      abilities: { STR: 10, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      spellMod: 0,
    });
    const target = foe(10);
    target.tempAcBonus = 5;
    // d20=12 → total 14; hits AC 10 but misses AC 15
    const result = resolveAttack(seqRng([0.55, 0.5]), attacker, target, 0);
    expect(result.hit).toBe(false);
    expect(result.total).toBe(14);
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

  describe("Sneak Attack SRD conditions", () => {
    it("applies with advantage and no ally (blinded target)", () => {
      const rogue = basePc({
        sneakAttackDice: 1,
        weapon: DAGGER,
        abilities: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      });
      const target = foe(5);
      target.condition = { name: "blinded", expiresRound: 99 };
      // adv: keep 15 from [0.2, 0.7]; d4=3 + DEX3 + SA d6=4 → 10
      const result = resolveAttack(seqRng([0.2, 0.7, 0.5, 0.5]), rogue, target, 0);
      expect(result.advantageMode).toBe("advantage");
      expect(result.hit).toBe(true);
      expect(result.damage).toBe(3 + 3 + 4);
      expect(rogue.sneakAttackUsedThisTurn).toBe(true);
    });

    it("applies with a living ally and no disadvantage", () => {
      const rogue = basePc({
        sneakAttackDice: 1,
        weapon: DAGGER,
        abilities: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      });
      const target = foe(5);
      // d20=15; d4=4 + DEX3 + SA d6=6 → 13
      const result = resolveAttack(seqRng([0.7, 0.9, 0.9]), rogue, target, 1);
      expect(result.advantageMode).toBe("none");
      expect(result.damage).toBe(4 + 3 + 6);
    });

    it("does not apply with an ally when the attacker has disadvantage", () => {
      const rogue = basePc({
        sneakAttackDice: 1,
        weapon: DAGGER,
        abilities: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 10, CHA: 10 },
        condition: { name: "blinded", expiresRound: 99 },
      });
      const target = foe(5);
      // disadv: rolls 18 and 10 → keep 10; d4=4 + DEX3 = 7 (no SA)
      const result = resolveAttack(seqRng([0.85, 0.45, 0.9, 0.9]), rogue, target, 2);
      expect(result.advantageMode).toBe("disadvantage");
      expect(result.hit).toBe(true);
      expect(result.damage).toBe(4 + 3);
      expect(rogue.sneakAttackUsedThisTurn).toBe(false);
    });

    it("never applies with a non-finesse non-ranged weapon", () => {
      const rogue = basePc({
        sneakAttackDice: 1,
        weapon: CLUB,
        abilities: { STR: 16, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      });
      const target = foe(5);
      target.condition = { name: "blinded", expiresRound: 99 };
      // advantage + allies, but club — no SA; d4=4 + STR3 = 7
      const result = resolveAttack(seqRng([0.2, 0.7, 0.9, 0.9]), rogue, target, 2);
      expect(result.advantageMode).toBe("advantage");
      expect(result.damage).toBe(4 + 3);
    });

    it("sneakAttackUsedThisTurn blocks a second application the same turn", () => {
      const rogue = basePc({
        sneakAttackDice: 1,
        weapon: DAGGER,
        abilities: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      });
      const target = foe(5);
      const first = resolveAttack(seqRng([0.7, 0.5, 0.5]), rogue, target, 1);
      expect(first.damage).toBe(3 + 3 + 4); // d4=3 + DEX3 + SA4
      expect(rogue.sneakAttackUsedThisTurn).toBe(true);
      const second = resolveAttack(seqRng([0.7, 0.9, 0.9]), rogue, target, 1);
      expect(second.damage).toBe(4 + 3); // no SA
    });
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

describe("resolveAutoSpell / Magic Missile", () => {
  it("deals 3 separate 1d4+1 darts with no attack roll", () => {
    const spell = getSpell("Magic Missile")!;
    // three d4 rolls forced to 2, 3, 4 → (2+1)+(3+1)+(4+1) = 12
    const result = resolveAutoSpell(seqRng([0.25, 0.5, 0.75]), spell);
    expect(result.damage).toBe(12);
  });

  it("ranges from 6 to 15 for three 1d4+1 darts", () => {
    const spell = getSpell("Magic Missile")!;
    const min = resolveAutoSpell(seqRng([0, 0, 0]), spell).damage;
    const max = resolveAutoSpell(seqRng([0.999, 0.999, 0.999]), spell).damage;
    expect(min).toBe(6);
    expect(max).toBe(15);
  });
});

describe("companionToCombatant spells", () => {
  it("assigns Magic Missile only when learned", () => {
    const withMm = companionToCombatant(
      wizardCharacter(
        [{ id: "1", name: "Fire Bolt", archetype: "Wizard" }],
        [{ id: "mm", name: "Magic Missile", archetype: "Wizard", level: 1 }],
      ),
      0,
      createRng(1),
    );
    expect(withMm.spell).toBe("Magic Missile");
    expect(withMm.spellSlots).toBe(2);

    const without = companionToCombatant(
      wizardCharacter([{ id: "1", name: "Fire Bolt", archetype: "Wizard" }], []),
      0,
      createRng(1),
    );
    expect(without.spell).toBeUndefined();
    expect(without.spellSlots).toBe(2);
  });

  it("assigns Sleep as controlSpell only when learned", () => {
    const withSleep = companionToCombatant(
      wizardCharacter(
        [{ id: "1", name: "Fire Bolt", archetype: "Wizard" }],
        [{ id: "sl", name: "Sleep", archetype: "Wizard", level: 1 }],
      ),
      0,
      createRng(1),
    );
    expect(withSleep.controlSpell).toBe("Sleep");
    expect(pickLearnedControlSpell([{ name: "Sleep" }])).toBe("Sleep");
    expect(pickLearnedControlSpell([{ name: "Color Spray" }])).toBe(
      "Color Spray",
    );
    expect(
      pickLearnedControlSpell([
        { name: "Color Spray" },
        { name: "Sleep" },
      ]),
    ).toBe("Sleep");

    const without = companionToCombatant(
      wizardCharacter([{ id: "1", name: "Fire Bolt", archetype: "Wizard" }], []),
      0,
      createRng(1),
    );
    expect(without.controlSpell).toBeUndefined();
  });
});

describe("resolveHpPool (Sleep)", () => {
  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => (i < values.length ? values[i++]! : 0.5);
  }

  it("covers two low-HP foes and stops before a higher-HP foe", () => {
    const spell = getSpell("Sleep")!;
    const low = foe(10);
    low.id = "a";
    low.hp = 3;
    low.maxHp = 3;
    const mid = foe(10);
    mid.id = "b";
    mid.hp = 4;
    mid.maxHp = 4;
    const high = foe(10);
    high.id = "c";
    high.hp = 10;
    high.maxHp = 10;
    // five d8s of 2 → pool 10; covers 3+4, stops at 10
    const { pool, affected } = resolveHpPool(
      seqRng([0.125, 0.125, 0.125, 0.125, 0.125]),
      spell,
      [high, mid, low],
    );
    expect(pool).toBe(10);
    expect(affected.map((c) => c.id)).toEqual(["a", "b"]);
    expect(high.condition).toBeNull();
  });

  it("excludes undead from the pool", () => {
    const spell = getSpell("Sleep")!;
    const undead = foe(10);
    undead.id = "u";
    undead.hp = 2;
    undead.maxHp = 2;
    undead.creatureType = "undead";
    const gob = foe(10);
    gob.id = "g";
    gob.hp = 2;
    gob.maxHp = 2;
    const { affected } = resolveHpPool(
      seqRng([0.125, 0.125, 0.125, 0.125, 0.125]),
      spell,
      [undead, gob],
    );
    expect(affected.map((c) => c.id)).toEqual(["g"]);
  });

  it("wakes an unconscious creature when damage is applied", () => {
    const target = foe(10);
    target.hp = 10;
    target.maxHp = 10;
    target.condition = { name: "unconscious", expiresRound: 99 };
    applyDamage(target, 1, "slashing");
    expect(target.condition).toBeNull();
    expect(target.hp).toBe(9);
  });
});

describe("advantage / disadvantage", () => {
  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => (i < values.length ? values[i++]! : 0.5);
  }

  it("resolveAdvantageMode cancels when both apply", () => {
    expect(resolveAdvantageMode(true, true)).toBe("none");
    expect(resolveAdvantageMode(true, false)).toBe("advantage");
    expect(resolveAdvantageMode(false, true)).toBe("disadvantage");
    expect(resolveAdvantageMode(false, false)).toBe("none");
  });

  it("rollD20 keeps the higher die on advantage", () => {
    // d20=3 then d20=18
    const r = rollD20(seqRng([0.1, 0.85]), { mode: "advantage" });
    expect(r.rolls).toEqual([3, 18]);
    expect(r.d20).toBe(18);
  });

  it("rollD20 keeps the lower die on disadvantage", () => {
    const r = rollD20(seqRng([0.1, 0.85]), { mode: "disadvantage" });
    expect(r.rolls).toEqual([3, 18]);
    expect(r.d20).toBe(3);
  });

  it("attacks against a blinded defender have advantage", () => {
    const attacker = basePc({
      cantrip: undefined,
      abilities: { STR: 10, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    });
    const target = foe(15);
    target.condition = { name: "blinded", expiresRound: 99 };
    expect(attackRollMode(attacker, target)).toBe("advantage");
    // rolls 3 and 18 → keep 18; bonus +2 = 20, hits AC 15
    const result = resolveAttack(seqRng([0.1, 0.85, 0.5]), attacker, target, 0);
    expect(result.advantageMode).toBe("advantage");
    expect(result.d20).toBe(18);
    expect(result.hit).toBe(true);
  });

  it("a blinded attacker has disadvantage", () => {
    const attacker = basePc({
      cantrip: undefined,
      abilities: { STR: 10, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      condition: { name: "blinded", expiresRound: 99 },
    });
    const target = foe(10);
    expect(attackRollMode(attacker, target)).toBe("disadvantage");
    // rolls 3 and 18 → keep 3; total 5, miss AC 10
    const result = resolveAttack(seqRng([0.1, 0.85]), attacker, target, 0);
    expect(result.advantageMode).toBe("disadvantage");
    expect(result.d20).toBe(3);
    expect(result.hit).toBe(false);
  });

  it("blinded vs blinded cancels to a normal roll", () => {
    const attacker = basePc({
      cantrip: undefined,
      condition: { name: "blinded", expiresRound: 99 },
    });
    const target = foe(10);
    target.condition = { name: "blinded", expiresRound: 99 };
    expect(attackRollMode(attacker, target)).toBe("none");
    // single roll only
    const result = resolveAttack(seqRng([0.55, 0.5]), attacker, target, 0);
    expect(result.advantageMode).toBe("none");
    expect(result.d20).toBe(12);
  });
});

describe("resolveHpPool (Color Spray)", () => {
  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => (i < values.length ? values[i++]! : 0.5);
  }

  it("blinds low-HP foes from a 6d10 pool and skips already-blinded", () => {
    const spell = getSpell("Color Spray")!;
    const low = foe(10);
    low.id = "a";
    low.hp = 3;
    low.maxHp = 3;
    const blinded = foe(10);
    blinded.id = "b";
    blinded.hp = 1;
    blinded.maxHp = 1;
    blinded.condition = { name: "blinded", expiresRound: 99 };
    const high = foe(10);
    high.id = "c";
    high.hp = 40;
    high.maxHp = 40;
    // six d10s of 2 → pool 12; covers a (3), skips blinded b, stops before c (40)
    const { pool, affected } = resolveHpPool(
      seqRng([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]),
      spell,
      [high, blinded, low],
    );
    expect(pool).toBe(12);
    expect(affected.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("damage traits + Rage", () => {
  it("halves resistant damage rounded down (odd amounts)", () => {
    const target = foe(10);
    target.hp = 20;
    target.maxHp = 20;
    target.resistances = ["slashing"];
    expect(modifyDamageByTraits(target, 5, "slashing")).toBe(2);
    expect(applyDamage(target, 5, "slashing")).toBe(2);
    expect(target.hp).toBe(18);
  });

  it("passes through unrelated damage types unchanged", () => {
    const target = foe(10);
    target.hp = 20;
    target.resistances = ["slashing"];
    expect(applyDamage(target, 5, "fire")).toBe(5);
    expect(target.hp).toBe(15);
  });

  it("doubles vulnerable damage", () => {
    const target = foe(10);
    target.hp = 20;
    target.vulnerabilities = ["fire"];
    expect(applyDamage(target, 5, "fire")).toBe(10);
    expect(target.hp).toBe(10);
  });

  it("immunity zeroes damage", () => {
    const target = foe(10);
    target.hp = 20;
    target.immunities = ["poison"];
    expect(applyDamage(target, 9, "poison")).toBe(0);
    expect(target.hp).toBe(20);
  });

  it("resist + vuln to the same type cancel to normal damage", () => {
    const target = foe(10);
    target.hp = 20;
    target.resistances = ["fire"];
    target.vulnerabilities = ["fire"];
    expect(modifyDamageByTraits(target, 7, "fire")).toBe(7);
    expect(applyDamage(target, 7, "fire")).toBe(7);
    expect(target.hp).toBe(13);
  });

  it("beginRage grants B/P/S resistance; non-raging takes full", () => {
    const raging = basePc({
      archetype: "Barbarian",
      ragesRemaining: 2,
    rageDamage: 0,
    rageMaintained: false,
    rageExpiresRound: null,
      hp: 20,
      maxHp: 20,
    });
    beginRage(raging);
    expect(raging.raging).toBe(true);
    expect(raging.ragesRemaining).toBe(1);
    expect(applyDamage(raging, 5, "slashing")).toBe(2);

    const calm = basePc({
      archetype: "Barbarian",
      ragesRemaining: 2,
    rageDamage: 0,
    rageMaintained: false,
    rageExpiresRound: null,
      hp: 20,
      maxHp: 20,
    });
    expect(applyDamage(calm, 5, "slashing")).toBe(5);
  });

  it("endRage strips B/P/S resistance", () => {
    const barb = basePc({ ragesRemaining: 1, hp: 20, maxHp: 20 });
    beginRage(barb);
    endRage(barb);
    expect(barb.raging).toBe(false);
    expect(applyDamage(barb, 5, "piercing")).toBe(5);
  });

  it("companionToCombatant gives Barbarians 2 rages at level 1", () => {
    expect(ragesForLevel(1)).toBe(2);
    const barb = wizardCharacter([], []);
    barb.id = "barb-1";
    barb.name = "Grok";
    barb.features = [
      {
        id: "barb-rage",
        feature: ["Rage"],
        archetype: "Barbarian",
      },
    ];
    barb.abilityScores = {
      STR: 16,
      DEX: 14,
      CON: 14,
      INT: 8,
      WIS: 10,
      CHA: 8,
    };
    barb.xp = 0;
    const c = companionToCombatant(barb, 0, createRng(1));
    expect(c.ragesRemaining).toBe(2);
    expect(c.rageDamage).toBe(2);
    expect(rageDamageForLevel(1)).toBe(2);
    expect(c.raging).toBe(false);
  });
});

describe("Rage clock, damage bonus, STR save adv", () => {
  const GREATAXE: Weapon = {
    name: "Greataxe",
    damage: { count: 1, sides: 12 },
    damageType: "slashing",
    properties: ["heavy", "two-handed"],
    finesse: false,
    ranged: false,
  };
  const DAGGER: Weapon = {
    name: "Dagger",
    damage: { count: 1, sides: 4 },
    damageType: "piercing",
    properties: ["finesse", "light", "thrown"],
    finesse: true,
    ranged: false,
  };
  const SHORTBOW: Weapon = {
    name: "Shortbow",
    damage: { count: 1, sides: 6 },
    damageType: "piercing",
    properties: ["ammunition", "two-handed"],
    finesse: false,
    ranged: true,
  };

  it("ends rage at turn start if neither attack nor damage maintained it", () => {
    const barb = basePc({
      archetype: "Barbarian",
      ragesRemaining: 2,
      rageDamage: 2,
      hp: 20,
      maxHp: 20,
    });
    beginRage(barb, 1);
    expect(barb.raging).toBe(true);
    expect(barb.resistances.map((r) => r.toLowerCase())).toEqual(
      expect.arrayContaining(["bludgeoning", "piercing", "slashing"]),
    );
    // No attack/damage → next turn start ends rage
    tickRageAtTurnStart(barb, 2);
    expect(barb.raging).toBe(false);
    expect(applyDamage(barb, 5, "slashing")).toBe(5);
  });

  it("keeps rage across turns when attack or damage maintains it", () => {
    const barb = basePc({
      archetype: "Barbarian",
      ragesRemaining: 2,
      rageDamage: 2,
      hp: 20,
      maxHp: 20,
    });
    beginRage(barb, 1);
    markRageAttack(barb);
    tickRageAtTurnStart(barb, 2);
    expect(barb.raging).toBe(true);
    expect(barb.rageMaintained).toBe(false);
    applyDamage(barb, 4, "fire"); // marks maintained
    expect(barb.rageMaintained).toBe(true);
    tickRageAtTurnStart(barb, 3);
    expect(barb.raging).toBe(true);
  });

  it("adds +2 Rage Damage only on Strength melee attacks", () => {
    const target = foe(5);
    const strMelee = basePc({
      archetype: "Barbarian",
      ragesRemaining: 1,
      rageDamage: 2,
      abilities: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 8 },
      weapon: GREATAXE,
    });
    beginRage(strMelee, 1);
    // d20=15 hit; d12=6 + STR3 + rage2 = 11
    const hit = resolveAttack(seqRng([0.7, 0.5]), strMelee, target, 0);
    expect(hit.hit).toBe(true);
    expect(hit.damage).toBe(12);

    const dexFinesse = basePc({
      archetype: "Barbarian",
      ragesRemaining: 1,
      rageDamage: 2,
      abilities: { STR: 10, DEX: 16, CON: 14, INT: 8, WIS: 10, CHA: 8 },
      weapon: DAGGER,
    });
    beginRage(dexFinesse, 1);
    // d20=15; d4=4 + DEX3 = 7 (no rage bonus)
    const fin = resolveAttack(seqRng([0.7, 0.9]), dexFinesse, target, 0);
    expect(fin.damage).toBe(7);

    const ranged = basePc({
      archetype: "Barbarian",
      ragesRemaining: 1,
      rageDamage: 2,
      abilities: { STR: 16, DEX: 14, CON: 14, INT: 8, WIS: 10, CHA: 8 },
      weapon: SHORTBOW,
    });
    beginRage(ranged, 1);
    // d20=15; d6=4 + DEX2 = 6 (ranged, no rage bonus)
    const bow = resolveAttack(seqRng([0.7, 0.6]), ranged, target, 0);
    expect(bow.damage).toBe(6);
  });

  it("raging Barbarian rolls Strength saves with advantage", () => {
    const caster = basePc({ spellMod: 3, proficiencyBonus: 2 });
    const barb = basePc({
      archetype: "Barbarian",
      ragesRemaining: 1,
      abilities: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 8 },
    });
    beginRage(barb, 1);
    // rolls 3 and 18 → keep 18; +3 STR = 21 vs DC 13
    const result = resolveSave(seqRng([0.1, 0.85]), caster, barb, {
      ability: "STR",
      onSuccess: "half",
      damageFull: 10,
    });
    expect(result.d20).toBe(18);
    expect(result.success).toBe(true);
    expect(result.total).toBe(21);
  });

  it("unconsciousness ends rage immediately", () => {
    const barb = basePc({
      archetype: "Barbarian",
      ragesRemaining: 1,
      hp: 20,
      maxHp: 20,
    });
    beginRage(barb, 1);
    markRageAttack(barb);
    setCondition(barb, "unconscious", 99);
    expect(barb.raging).toBe(false);
    expect(applyDamage(barb, 5, "slashing")).toBe(5);
  });
});

describe("resolveSave (Burning Hands / Thunderwave)", () => {
  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => (i < values.length ? values[i++]! : 0.5);
  }

  it("computes DC as 8 + proficiency + spellMod", () => {
    const caster = basePc({ proficiencyBonus: 2, spellMod: 3 });
    expect(spellSaveDC(caster)).toBe(13);
  });

  it("applies full damage on fail and half floor on success against shared damage", () => {
    const caster = basePc({ proficiencyBonus: 2, spellMod: 3 });
    const weak = foe(10);
    weak.abilities = { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 };
    const strong = foe(10);
    strong.abilities = { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 };
    const damageFull = 17;
    const fail = resolveSave(seqRng([0.5]), caster, weak, {
      ability: "DEX",
      onSuccess: "half",
      damageFull,
    });
    const ok = resolveSave(seqRng([0.9]), caster, strong, {
      ability: "DEX",
      onSuccess: "half",
      damageFull,
    });
    expect(fail).toMatchObject({
      success: false,
      damage: 17,
      damageFull: 17,
      dc: 13,
    });
    expect(ok).toMatchObject({
      success: true,
      damage: 8,
      damageFull: 17,
      dc: 13,
    });
  });

  it("rolls Burning Hands damage once via rollSpellDamage", () => {
    const spell = getSpell("Burning Hands")!;
    // 3d6 of 6 → 18
    expect(rollSpellDamage(seqRng([0.9, 0.9, 0.9]), spell)).toBe(18);
  });

  it("picks Burning Hands over Thunderwave when both are learned", () => {
    expect(
      pickLearnedSaveSpell([
        { name: "Thunderwave" },
        { name: "Burning Hands" },
      ]),
    ).toBe("Burning Hands");
    expect(pickLearnedSaveSpell([{ name: "Thunderwave" }])).toBe(
      "Thunderwave",
    );
  });

  it("assigns saveSpell from learned Burning Hands", () => {
    const c = companionToCombatant(
      wizardCharacter(
        [{ id: "1", name: "Fire Bolt", archetype: "Wizard" }],
        [{ id: "bh", name: "Burning Hands", archetype: "Wizard", level: 1 }],
      ),
      0,
      createRng(1),
    );
    expect(c.saveSpell).toBe("Burning Hands");
  });
});

describe("Guiding Bolt / Inflict Wounds / guided", () => {
  it("Guiding Bolt hit deals 4d6 radiant via spell-attack path and applies guided", () => {
    const attacker = basePc({ spellMod: 3, proficiencyBonus: 2 });
    const target = foe(5);
    // d20=15 → total 20 hit; four d6 = 6 each → 24
    const result = resolveAttack(seqRng([0.7, 0.9, 0.9, 0.9, 0.9]), attacker, target, 0, {
      spellAttack: "Guiding Bolt",
    });
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(24);
    expect(result.total).toBe(20);
    // onHitCondition is applied by combat — resolveAttack only rolls damage
    setCondition(target, "guided", 3);
    expect(hasCondition(target, "guided")).toBe(true);
  });

  it("guided grants advantage on the next attack then is consumed", () => {
    const attacker = basePc();
    const target = foe(10);
    setCondition(target, "guided", 99);
    expect(attackRollMode(attacker, target)).toBe("advantage");
    // low first die, high second → advantage keeps 18; no damage die needed for miss? AC 10, total 18+5=23 hit
    // weapon club: need damage die after hit
    const first = resolveAttack(seqRng([0.05, 0.85, 0.5]), attacker, target, 0);
    expect(first.advantageMode).toBe("advantage");
    expect(hasCondition(target, "guided")).toBe(false);
    expect(attackRollMode(attacker, target)).toBe("none");
    const second = resolveAttack(seqRng([0.55, 0.5]), attacker, target, 0);
    expect(second.advantageMode).toBe("none");
  });

  it("guided expires naturally if unused by expiresRound", () => {
    const target = foe(10);
    setCondition(target, "guided", 3);
    expireConditionIfDue(target, 2);
    expect(hasCondition(target, "guided")).toBe(true);
    expireConditionIfDue(target, 3);
    expect(hasCondition(target, "guided")).toBe(false);
  });

  it("Inflict Wounds uses 3d10 via the same spell-attack path, distinct from Guiding Bolt", () => {
    const attacker = basePc({ spellMod: 3, proficiencyBonus: 2 });
    const target = foe(5);
    // d20=15; three d10 = 10 → 30
    const iw = resolveAttack(seqRng([0.7, 0.95, 0.95, 0.95]), attacker, target, 0, {
      spellAttack: "Inflict Wounds",
    });
    expect(iw.hit).toBe(true);
    expect(iw.damage).toBe(30);

    const gb = resolveAttack(seqRng([0.7, 0.9, 0.9, 0.9, 0.9]), attacker, target, 0, {
      spellAttack: "Guiding Bolt",
    });
    expect(gb.damage).toBe(24);
    expect(getSpell("Inflict Wounds")!.damage).toMatchObject({
      count: 3,
      sides: 10,
      type: "necrotic",
    });
    expect(getSpell("Guiding Bolt")!.damage).toMatchObject({
      count: 4,
      sides: 6,
      type: "radiant",
    });
  });

  it("picks Guiding Bolt over Inflict Wounds; heals split by slot", () => {
    expect(
      pickLearnedAttackSpell([
        { name: "Inflict Wounds" },
        { name: "Guiding Bolt" },
      ]),
    ).toBe("Guiding Bolt");
    expect(pickLearnedAttackSpell([{ name: "Inflict Wounds" }])).toBe(
      "Inflict Wounds",
    );
    expect(
      pickLearnedHealSpell([
        { name: "Healing Word" },
        { name: "Cure Wounds" },
      ]),
    ).toBe("Cure Wounds");
    expect(pickLearnedHealSpell([{ name: "Healing Word" }])).toBeUndefined();
    expect(
      pickLearnedBonusHealSpell([
        { name: "Healing Word" },
        { name: "Cure Wounds" },
      ]),
    ).toBe("Healing Word");
    expect(pickLearnedBonusHealSpell([{ name: "Cure Wounds" }])).toBeUndefined();
  });

  it("Healing Word heals 1d4 + spellMod; Cure Wounds uses 1d8", () => {
    const hw = basePc({
      healSpell: "Healing Word",
      healDice: { count: 1, sides: 4 },
      spellMod: 3,
    });
    expect(resolveCureWounds(seqRng([0.75]), hw)).toBe(4 + 3);
    const cw = basePc({
      healSpell: "Cure Wounds",
      healDice: { count: 1, sides: 8 },
      spellMod: 3,
    });
    expect(resolveCureWounds(seqRng([0.875]), cw)).toBe(8 + 3);
  });

  it("clearCondition and blinded still grant lasting advantage (not consumed)", () => {
    const attacker = basePc();
    const target = foe(10);
    setCondition(target, "blinded", 99);
    resolveAttack(seqRng([0.05, 0.85, 0.5]), attacker, target, 0);
    expect(hasCondition(target, "blinded")).toBe(true);
    clearCondition(target);
    expect(hasCondition(target, "blinded")).toBe(false);
  });
});

describe("Archery / Great Weapon Fighting / diceRerollLow", () => {
  const SHORTBOW: Weapon = {
    name: "Shortbow",
    damage: { count: 1, sides: 6 },
    damageType: "piercing",
    properties: ["Ammunition", "Two-handed"],
    finesse: false,
    ranged: true,
  };
  const GREATAXE: Weapon = {
    name: "Greataxe",
    damage: { count: 1, sides: 12 },
    damageType: "slashing",
    properties: ["Heavy", "Two-handed"],
    finesse: false,
    ranged: false,
  };

  it("diceRerollLow rerolls a 1 or 2 once and keeps the second roll", () => {
    // first die: 1 → reroll 6; second die: 4 kept (no reroll)
    expect(diceRerollLow(seqRng([0.0, 0.9, 0.5]), 2, 6, 2)).toBe(6 + 4);
  });

  it("Archery adds +2 to ranged weapon attack totals", () => {
    const archer = basePc({
      archery: true,
      weapon: SHORTBOW,
      abilities: { STR: 10, DEX: 14, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    });
    const target = foe(15);
    // d20=12 → 12 + DEX2 + prof2 + Archery2 = 18
    const result = resolveAttack(seqRng([0.55, 0.5]), archer, target, 0);
    expect(result.hit).toBe(true);
    expect(result.total).toBe(18);
  });

  it("Archery does not apply to melee weapons", () => {
    const fighter = basePc({
      archery: true,
      weapon: CLUB,
      abilities: { STR: 14, DEX: 10, CON: 12, INT: 10, WIS: 10, CHA: 10 },
    });
    const target = foe(10);
    // d20=12 → 12 + STR2 + prof2 = 16 (no archery)
    const result = resolveAttack(seqRng([0.55, 0.5]), fighter, target, 0);
    expect(result.total).toBe(16);
  });

  it("Great Weapon Fighting rerolls low damage dice on two-handed melee", () => {
    const gwf = basePc({
      greatWeaponFighting: true,
      weapon: GREATAXE,
      abilities: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 8 },
    });
    const target = foe(5);
    // d20=15 hit; d12 rolls 1 → reroll 10; +STR3 = 13
    const result = resolveAttack(seqRng([0.7, 0.0, 0.8]), gwf, target, 0);
    expect(result.hit).toBe(true);
    expect(result.damage).toBe(13);
  });
});
