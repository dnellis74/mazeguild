import { describe, expect, it } from "vitest";
import {
  addRollModifier,
  applyDamage,
  checkConcentrationOnDamage,
  concentrationSaveDC,
  endConcentration,
  removeRollModifier,
  resolveAttack,
  resolveSave,
  rollModifierBonus,
  setCondition,
  startConcentration,
} from "./rules";
import type { Combatant, Weapon } from "./types";
import { DYING_DEFAULTS, HIT_DICE_DEFAULTS, TRAIT_DEFAULTS, WEAR_DEFAULTS } from "./dyingDefaults";

const CLUB: Weapon = {
  name: "Club",
  damage: { count: 1, sides: 4 },
  damageType: "bludgeoning",
  properties: [],
  finesse: false,
  ranged: false,
};

function combatant(over: Partial<Combatant> & { id: string }): Combatant {
  return {
    name: over.id,
    kind: "pc",
    archetype: "Cleric",
    race: "Human",
    role: "healer",
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 10 },
    proficiencyBonus: 2,
    ac: 10,
    maxHp: 20,
    hp: 20,
    alive: true,
    ...DYING_DEFAULTS,
    ...HIT_DICE_DEFAULTS,
    ...WEAR_DEFAULTS,
    ...TRAIT_DEFAULTS,
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
    spellSlots: 2,
    spellMod: 2,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
    ...over,
  };
}

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++]! : 0.5);
}

describe("Part 1: concentration (mock effect, not Bless)", () => {
  it("startConcentration sets the field", () => {
    const c = combatant({ id: "caster" });
    let cleaned = 0;
    startConcentration(c, "MockSpell", 1, () => {
      cleaned += 1;
    });
    expect(c.concentratingOn?.spellName).toBe("MockSpell");
    expect(c.concentratingOn?.startedRound).toBe(1);
    expect(cleaned).toBe(0);
  });

  it("starting a second concentration ends the first and runs cleanup", () => {
    const c = combatant({ id: "caster" });
    const cleanups: string[] = [];
    startConcentration(c, "First", 1, () => cleanups.push("First"));
    startConcentration(c, "Second", 2, () => cleanups.push("Second"));
    expect(c.concentratingOn?.spellName).toBe("Second");
    expect(cleanups).toEqual(["First"]);
  });

  it("concentrationSaveDC never goes below 10", () => {
    expect(concentrationSaveDC(1)).toBe(10);
    expect(concentrationSaveDC(18)).toBe(10);
    expect(concentrationSaveDC(22)).toBe(11);
  });

  it("failed concentration save (damage forcing DC>10) ends and cleans up", () => {
    const c = combatant({
      id: "caster",
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    });
    let cleaned = 0;
    startConcentration(c, "MockSpell", 1, () => {
      cleaned += 1;
    });
    // damageTaken 30 → DC 15; d20=1 → total 1 → fail
    const kept = checkConcentrationOnDamage(seqRng([0]), c, 30);
    expect(kept).toBe(false);
    expect(c.concentratingOn).toBeNull();
    expect(cleaned).toBe(1);
  });

  it("successful concentration save leaves concentration intact", () => {
    const c = combatant({
      id: "caster",
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    });
    let cleaned = 0;
    startConcentration(c, "MockSpell", 1, () => {
      cleaned += 1;
    });
    // DC 10; d20=20 → success
    const kept = checkConcentrationOnDamage(seqRng([0.95]), c, 5);
    expect(kept).toBe(true);
    expect(c.concentratingOn?.spellName).toBe("MockSpell");
    expect(cleaned).toBe(0);
  });

  it("becoming unconscious ends concentration with no save", () => {
    const c = combatant({ id: "caster" });
    let cleaned = 0;
    startConcentration(c, "MockSpell", 1, () => {
      cleaned += 1;
    });
    setCondition(c, "unconscious", 99);
    expect(c.concentratingOn).toBeNull();
    expect(cleaned).toBe(1);
  });

  it("dying ends concentration with no save via unconscious incapacitation", () => {
    const c = combatant({ id: "caster", hp: 3 });
    let cleaned = 0;
    startConcentration(c, "MockSpell", 1, () => {
      cleaned += 1;
    });
    applyDamage(c, 10, "slashing"); // leftover 7 < maxHp 20 → dying, not dead
    expect(c.alive).toBe(true);
    expect(c.hp).toBe(0);
    expect(c.condition?.name).toBe("unconscious");
    expect(c.concentratingOn).toBeNull();
    expect(cleaned).toBe(1);
  });

  it("two damage instances in one round trigger two separate saves", () => {
    const c = combatant({
      id: "caster",
      hp: 40,
      maxHp: 40,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    });
    let cleaned = 0;
    startConcentration(c, "MockSpell", 1, () => {
      cleaned += 1;
    });
    // First hit: succeed (d20=20). Second: fail (d20=1) at DC 10.
    const rng = seqRng([0.95, 0]);
    applyDamage(c, 5, "slashing", rng);
    expect(c.concentratingOn?.spellName).toBe("MockSpell");
    applyDamage(c, 5, "slashing", rng);
    expect(c.concentratingOn).toBeNull();
    expect(cleaned).toBe(1);
  });
});

describe("Part 2: rollModifiers (hand-built, no Bless)", () => {
  it("attack-affecting modifier changes the attack total with a fresh die", () => {
    const attacker = combatant({
      id: "atk",
      cantrip: undefined,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      rollModifiers: [
        {
          source: "TestBuff",
          affects: "attack",
          die: { count: 1, sides: 4 },
          sign: 1,
        },
      ],
    });
    const target = combatant({ id: "def", kind: "monster", ac: 30 });
    // d20=10 (0.45), mod die=4 (0.9) → total 10+2+4=16
    const a = resolveAttack(seqRng([0.45, 0.9]), attacker, target, 0);
    expect(a.d20).toBe(10);
    expect(a.total).toBe(16);
    // second call: mod die=1 (0) → total 10+2+1=13 (fresh, not cached)
    const b = resolveAttack(seqRng([0.45, 0]), attacker, target, 0);
    expect(b.total).toBe(13);
  });

  it("save-affecting modifier changes the save total", () => {
    const caster = combatant({ id: "wiz", spellMod: 3, proficiencyBonus: 2 });
    const defender = combatant({
      id: "gob",
      kind: "monster",
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      rollModifiers: [
        {
          source: "TestBuff",
          affects: "save",
          die: { count: 1, sides: 4 },
          sign: 1,
        },
      ],
    });
    // DC 13; d20=10, mod=4 → total 14 success
    const r = resolveSave(seqRng([0.45, 0.9]), caster, defender, {
      ability: "DEX",
      onSuccess: "half",
      damageFull: 10,
    });
    expect(r.total).toBe(14);
    expect(r.success).toBe(true);
  });

  it("both-affecting modifier applies to attack and save", () => {
    const c = combatant({
      id: "pc",
      cantrip: undefined,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    });
    addRollModifier(c, {
      source: "Both",
      affects: "both",
      die: { count: 1, sides: 4 },
      sign: 1,
    });
    expect(rollModifierBonus(seqRng([0.9]), c, "attack")).toBe(4);
    expect(rollModifierBonus(seqRng([0.9]), c, "save")).toBe(4);
  });

  it("negative-sign modifier subtracts", () => {
    const c = combatant({ id: "pc" });
    addRollModifier(c, {
      source: "Bane",
      affects: "attack",
      die: { count: 1, sides: 4 },
      sign: -1,
    });
    expect(rollModifierBonus(seqRng([0.9]), c, "attack")).toBe(-4);
  });

  it("same source replaces rather than stacks", () => {
    const c = combatant({ id: "pc" });
    addRollModifier(c, {
      source: "Bless",
      affects: "both",
      die: { count: 1, sides: 4 },
      sign: 1,
    });
    addRollModifier(c, {
      source: "Bless",
      affects: "both",
      die: { count: 1, sides: 6 },
      sign: 1,
    });
    expect(c.rollModifiers).toHaveLength(1);
    expect(c.rollModifiers[0]?.die.sides).toBe(6);
  });

  it("removeRollModifier drops only that source", () => {
    const c = combatant({ id: "pc" });
    addRollModifier(c, {
      source: "Bless",
      affects: "both",
      die: { count: 1, sides: 4 },
      sign: 1,
    });
    addRollModifier(c, {
      source: "Other",
      affects: "attack",
      die: { count: 1, sides: 4 },
      sign: 1,
    });
    removeRollModifier(c, "Bless");
    expect(c.rollModifiers.map((m) => m.source)).toEqual(["Other"]);
  });
});

describe("Part 3: Bless integration (concentration + modifiers)", () => {
  function castBless(
    caster: Combatant,
    allies: Combatant[],
    round: number,
  ): Combatant[] {
    const blessed = allies
      .filter((a) => a.alive)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, 3);
    startConcentration(caster, "Bless", round, () => {
      for (const t of blessed) removeRollModifier(t, "Bless");
    });
    for (const t of blessed) {
      addRollModifier(t, {
        source: "Bless",
        affects: "both",
        die: { count: 1, sides: 4 },
        sign: 1,
      });
    }
    return blessed;
  }

  it("gives each of three allies a Bless modifier and sets concentratingOn", () => {
    const caster = combatant({ id: "clr" });
    const a = combatant({ id: "a" });
    const b = combatant({ id: "b" });
    const c = combatant({ id: "c" });
    castBless(caster, [a, b, c], 1);
    expect(caster.concentratingOn?.spellName).toBe("Bless");
    for (const t of [a, b, c]) {
      expect(t.rollModifiers).toEqual([
        {
          source: "Bless",
          affects: "both",
          die: { count: 1, sides: 4 },
          sign: 1,
        },
      ]);
    }
  });

  it("applies a fresh 1d4 to an ally attack and save", () => {
    const caster = combatant({ id: "clr" });
    const ally = combatant({
      id: "a",
      cantrip: undefined,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    });
    castBless(caster, [ally], 1);
    const foe = combatant({ id: "gob", kind: "monster", ac: 30 });
    // d20=10, bless d4=4 → total 16
    const atk = resolveAttack(seqRng([0.45, 0.9]), ally, foe, 0);
    expect(atk.total).toBe(16);
    const wiz = combatant({ id: "wiz", spellMod: 3, proficiencyBonus: 2 });
    // d20=10, bless=4 → total 14 vs DC 13
    const sav = resolveSave(seqRng([0.45, 0.9]), wiz, ally, {
      ability: "DEX",
      onSuccess: "half",
      damageFull: 8,
    });
    expect(sav.total).toBe(14);
  });

  it("failed concentration save removes Bless from all affected allies", () => {
    const caster = combatant({
      id: "clr",
      hp: 40,
      maxHp: 40,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    });
    const a = combatant({ id: "a" });
    const b = combatant({ id: "b" });
    const c = combatant({ id: "c" });
    castBless(caster, [a, b, c], 1);
    // DC 15 (damage 30); d20=1 fails
    applyDamage(caster, 30, "slashing", seqRng([0]));
    expect(caster.concentratingOn).toBeNull();
    expect(a.rollModifiers).toEqual([]);
    expect(b.rollModifiers).toEqual([]);
    expect(c.rollModifiers).toEqual([]);
  });

  it("recasting Bless on the same target replaces rather than stacks", () => {
    const caster = combatant({ id: "clr" });
    const ally = combatant({ id: "a" });
    castBless(caster, [ally], 1);
    castBless(caster, [ally], 2);
    expect(ally.rollModifiers).toHaveLength(1);
    expect(ally.rollModifiers[0]?.source).toBe("Bless");
    expect(caster.concentratingOn?.startedRound).toBe(2);
  });

  it("caster death tears down Bless on all allies", () => {
    const caster = combatant({ id: "clr", hp: 5 });
    const a = combatant({ id: "a" });
    const b = combatant({ id: "b" });
    castBless(caster, [a, b], 1);
    applyDamage(caster, 30, "slashing"); // leftover 25 ≥ maxHp 20 → instant death
    expect(caster.alive).toBe(false);
    expect(caster.concentratingOn).toBeNull();
    expect(a.rollModifiers).toEqual([]);
    expect(b.rollModifiers).toEqual([]);
  });

  it("caster unconsciousness tears down Bless on all allies", () => {
    const caster = combatant({ id: "clr" });
    const a = combatant({ id: "a" });
    castBless(caster, [a], 1);
    setCondition(caster, "unconscious", 99);
    expect(caster.concentratingOn).toBeNull();
    expect(a.rollModifiers).toEqual([]);
  });
});
