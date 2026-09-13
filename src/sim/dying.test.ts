import { describe, expect, it } from "vitest";
import {
  applyDamage,
  applyHeal,
  grantTempHp,
  hasCondition,
  processDeathSave,
  stabilizeCombatant,
} from "./rules";
import { chooseAction } from "./tactics";
import { runDungeon } from "./run";
import { DYING_DEFAULTS } from "./dyingDefaults";
import type { Character } from "@/training/types";
import type { Combatant, Weapon } from "./types";
import { readFileSync } from "node:fs";
import path from "node:path";

const CLUB: Weapon = {
  name: "Club",
  damage: { count: 1, sides: 4 },
  damageType: "bludgeoning",
  properties: [],
  finesse: false,
  ranged: false,
};

function pc(over: Partial<Combatant> = {}): Combatant {
  return {
    id: "pc",
    name: "Hero",
    kind: "pc",
    archetype: "Fighter",
    race: "Human",
    role: "tank",
    abilities: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    proficiencyBonus: 2,
    ac: 16,
    maxHp: 20,
    hp: 20,
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
    ...over,
  };
}

function monster(over: Partial<Combatant> = {}): Combatant {
  return pc({
    id: "gob",
    name: "Goblin",
    kind: "monster",
    archetype: "Monster",
    role: "dps",
    maxHp: 7,
    hp: 7,
    ...over,
  });
}

/** Deterministic d20: value = floor(u * 20) + 1 → u = (n - 1) / 20. */
function d20u(n: number): number {
  return (n - 1) / 20 + 1e-9;
}

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++]! : 0.5);
}

describe("temp HP", () => {
  it("grantTempHp keeps the max (never additive)", () => {
    const c = pc();
    grantTempHp(c, 5);
    expect(c.tempHp).toBe(5);
    grantTempHp(c, 3);
    expect(c.tempHp).toBe(5);
    grantTempHp(c, 8);
    expect(c.tempHp).toBe(8);
  });

  it("absorbs damage before real HP and never goes negative", () => {
    const c = pc({ hp: 10, tempHp: 4 });
    applyDamage(c, 3, "slashing");
    expect(c.tempHp).toBe(1);
    expect(c.hp).toBe(10);
    applyDamage(c, 5, "slashing");
    expect(c.tempHp).toBe(0);
    expect(c.hp).toBe(6);
  });

  it("temp HP at 0 HP does not wake or stabilize", () => {
    const c = pc({ hp: 3 });
    applyDamage(c, 10, "slashing");
    expect(c.hp).toBe(0);
    expect(hasCondition(c, "unconscious")).toBe(true);
    grantTempHp(c, 5);
    expect(c.tempHp).toBe(5);
    expect(c.hp).toBe(0);
    expect(c.stable).toBe(false);
    expect(hasCondition(c, "unconscious")).toBe(true);
    expect(c.alive).toBe(true);
  });
});

describe("PC dying / instant death", () => {
  it("leftover under maxHp → dying unconscious, not dead", () => {
    const c = pc({ hp: 3, maxHp: 20 });
    applyDamage(c, 10, "slashing");
    expect(c.alive).toBe(true);
    expect(c.hp).toBe(0);
    expect(hasCondition(c, "unconscious")).toBe(true);
    expect(c.deathSaveSuccesses).toBe(0);
    expect(c.deathSaveFailures).toBe(0);
    expect(c.stable).toBe(false);
  });

  it("leftover at or above maxHp → instant death", () => {
    const c = pc({ hp: 5, maxHp: 20 });
    applyDamage(c, 30, "slashing"); // leftover 25 ≥ 20
    expect(c.alive).toBe(false);
    expect(c.hp).toBe(0);
  });

  it("monsters still die instantly at 0 HP", () => {
    const m = monster({ hp: 3, maxHp: 7 });
    applyDamage(m, 10, "slashing");
    expect(m.alive).toBe(false);
    expect(m.hp).toBe(0);
    expect(m.condition).toBeNull();
  });
});

describe("death saving throws", () => {
  it("three successes stabilizes", () => {
    const c = pc({ hp: 0, deathSaveSuccesses: 0, deathSaveFailures: 0 });
    // Force dying state presentation
    c.condition = { name: "unconscious", expiresRound: 9999 };
    const rng = seqRng([d20u(15), d20u(12), d20u(10)]);
    expect(processDeathSave(rng, c).outcome).toBe("success");
    expect(processDeathSave(rng, c).outcome).toBe("success");
    const third = processDeathSave(rng, c);
    expect(third.outcome).toBe("stabilized");
    expect(c.stable).toBe(true);
    expect(c.alive).toBe(true);
    expect(c.hp).toBe(0);
    expect(c.deathSaveSuccesses).toBe(0);
    expect(c.deathSaveFailures).toBe(0);
  });

  it("three failures kills", () => {
    const c = pc({ hp: 0 });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    const rng = seqRng([d20u(5), d20u(3), d20u(2)]);
    processDeathSave(rng, c);
    processDeathSave(rng, c);
    const third = processDeathSave(rng, c);
    expect(third.outcome).toBe("died");
    expect(c.alive).toBe(false);
  });

  it("natural 1 counts as two failures", () => {
    const c = pc({ hp: 0, deathSaveFailures: 1 });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    const result = processDeathSave(seqRng([d20u(1)]), c);
    expect(result.outcome).toBe("died");
    expect(result.failures).toBe(3);
    expect(c.alive).toBe(false);
  });

  it("natural 20 sets hp to 1 and clears unconscious", () => {
    const c = pc({ hp: 0, deathSaveSuccesses: 2, deathSaveFailures: 1 });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    const result = processDeathSave(seqRng([d20u(20)]), c);
    expect(result.outcome).toBe("revived");
    expect(c.hp).toBe(1);
    expect(c.condition).toBeNull();
    expect(c.deathSaveSuccesses).toBe(0);
    expect(c.deathSaveFailures).toBe(0);
    expect(c.alive).toBe(true);
  });
});

describe("damage while already at 0 HP", () => {
  it("is an automatic failure and does not reduce HP below 0", () => {
    const c = pc({ hp: 3 });
    applyDamage(c, 10, "slashing");
    expect(c.hp).toBe(0);
    applyDamage(c, 4, "slashing");
    expect(c.hp).toBe(0);
    expect(c.deathSaveFailures).toBe(1);
    expect(c.alive).toBe(true);
  });

  it("critical hit at 0 HP is two failures", () => {
    const c = pc({ hp: 0 });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    applyDamage(c, 3, "slashing", undefined, true);
    expect(c.deathSaveFailures).toBe(2);
    expect(c.hp).toBe(0);
  });

  it("hit at 0 whose damage alone ≥ maxHp is instant death", () => {
    const c = pc({ hp: 0, maxHp: 20 });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    applyDamage(c, 20, "slashing");
    expect(c.alive).toBe(false);
  });

  it("stable combatant that takes damage resumes from zero then fails once", () => {
    const c = pc({
      hp: 0,
      stable: true,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
    });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    applyDamage(c, 2, "slashing");
    expect(c.stable).toBe(false);
    expect(c.deathSaveSuccesses).toBe(0);
    expect(c.deathSaveFailures).toBe(1);
    expect(c.alive).toBe(true);
  });
});

describe("healing at 0 HP", () => {
  it("clears unconscious and resets death-save counts", () => {
    const c = pc({ hp: 0, deathSaveSuccesses: 2, deathSaveFailures: 1 });
    c.condition = { name: "unconscious", expiresRound: 9999 };
    c.stable = true;
    applyHeal(c, 5);
    expect(c.hp).toBe(5);
    expect(c.condition).toBeNull();
    expect(c.deathSaveSuccesses).toBe(0);
    expect(c.deathSaveFailures).toBe(0);
    expect(c.stable).toBe(false);
  });
});

describe("Spare the Dying", () => {
  it("stabilizes a dying ally with no roll; ignores non-dying allies", () => {
    const cleric = pc({
      id: "clr",
      stabilizeCantrip: "Spare the Dying",
      cantrip: "Sacred Flame",
    });
    const dying = pc({
      id: "down",
      hp: 0,
      condition: { name: "unconscious", expiresRound: 9999 },
    });
    const healthy = pc({ id: "ok", hp: 10 });
    const intent = chooseAction(cleric, [cleric, dying, healthy], [
      monster({ id: "foe" }),
    ]);
    expect(intent).toEqual({
      type: "stabilize",
      targetId: "down",
      ability: "Spare the Dying",
    });
    expect(stabilizeCombatant(dying)).toBe(true);
    expect(dying.stable).toBe(true);
    expect(dying.hp).toBe(0);
    expect(stabilizeCombatant(healthy)).toBe(false);
    expect(stabilizeCombatant(dying)).toBe(false); // already stable
  });
});

describe("runDungeon determinism with death saves", () => {
  it("same-seed runs stay byte-identical", () => {
    const party = JSON.parse(
      readFileSync(path.join(__dirname, "../data/sample-party.json"), "utf8"),
    ) as Character[];
    const a = runDungeon({ seed: 42, party });
    const b = runDungeon({ seed: 42, party });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
