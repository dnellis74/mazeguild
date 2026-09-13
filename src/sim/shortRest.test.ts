import { describe, expect, it } from "vitest";
import { DYING_DEFAULTS, HIT_DICE_DEFAULTS } from "./dyingDefaults";
import { applyShortRest } from "./shortRest";
import type { Combatant, LogEvent, Weapon } from "./types";

const CLUB: Weapon = {
  name: "Club",
  damage: { count: 1, sides: 4 },
  damageType: "bludgeoning",
  properties: [],
  finesse: false,
  ranged: false,
};

function pc(over: Partial<Combatant> & { id: string }): Combatant {
  return {
    name: over.id,
    kind: "pc",
    archetype: "Fighter",
    race: "Human",
    role: "tank",
    abilities: { STR: 15, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 8 },
    proficiencyBonus: 2,
    ac: 16,
    maxHp: 12,
    hp: 12,
    alive: true,
    ...DYING_DEFAULTS,
    ...HIT_DICE_DEFAULTS,
    hitDieSides: 10,
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

describe("applyShortRest", () => {
  it("spends Hit Dice to heal and restores Second Wind", () => {
    const fighter = pc({
      id: "f1",
      name: "Aldric",
      hp: 2,
      maxHp: 12,
      hitDiceTotal: 2,
      hitDiceRemaining: 2,
      hitDieSides: 10,
      secondWindAvailable: false,
      secondWindLevel: 1,
    });
    const log: LogEvent[] = [];
    // Fixed rolls: first HD = 10, second unused if already full-ish
    let i = 0;
    const rolls = [0.99]; // d10 → 10; + CON(+2) = 12 → full from 2
    const rng = () => rolls[i++] ?? 0.5;

    applyShortRest(rng, [fighter], log);

    expect(fighter.hp).toBe(12);
    expect(fighter.hitDiceRemaining).toBe(1);
    expect(fighter.secondWindAvailable).toBe(true);
    expect(log[0]).toMatchObject({
      event: "short_rest",
      secondWindRestored: ["Aldric"],
    });
    const rest = log[0];
    expect(rest?.event).toBe("short_rest");
    if (rest?.event === "short_rest") {
      expect(rest.heals[0]).toMatchObject({
        name: "Aldric",
        amount: 10,
        hpAfter: 12,
        hitDiceSpent: 1,
        hitDiceRemaining: 1,
      });
    }
  });

  it("restores Warlock slots but not Wizard slots", () => {
    const warlock = pc({
      id: "w1",
      name: "Hex",
      archetype: "Warlock",
      spellSlots: 0,
      hp: 8,
      maxHp: 8,
      hitDiceRemaining: 0,
    });
    const wizard = pc({
      id: "wz",
      name: "Mira",
      archetype: "Wizard",
      spellSlots: 0,
      hp: 8,
      maxHp: 8,
      hitDiceRemaining: 0,
    });
    const log: LogEvent[] = [];
    applyShortRest(() => 0.5, [warlock, wizard], log);

    expect(warlock.spellSlots).toBe(1);
    expect(wizard.spellSlots).toBe(0);
    const rest = log[0];
    expect(rest?.event).toBe("short_rest");
    if (rest?.event === "short_rest") {
      expect(rest.warlockSlotsRestored).toEqual(["Hex"]);
    }
  });

  it("does not refresh Rage uses", () => {
    const barb = pc({
      id: "b1",
      name: "Grok",
      archetype: "Barbarian",
      ragesRemaining: 1,
      hp: 10,
      maxHp: 10,
      hitDiceRemaining: 0,
    });
    applyShortRest(() => 0.5, [barb], []);
    expect(barb.ragesRemaining).toBe(1);
  });

  it("skips dead combatants", () => {
    const dead = pc({
      id: "d1",
      name: "Ghost",
      alive: false,
      hp: 0,
      hitDiceRemaining: 3,
      secondWindLevel: 1,
      secondWindAvailable: false,
    });
    const log: LogEvent[] = [];
    applyShortRest(() => 0.99, [dead], log);
    expect(dead.hitDiceRemaining).toBe(3);
    expect(dead.secondWindAvailable).toBe(false);
    const rest = log[0];
    expect(rest?.event).toBe("short_rest");
    if (rest?.event === "short_rest") {
      expect(rest.heals).toEqual([]);
      expect(rest.secondWindRestored).toEqual([]);
    }
  });
});
