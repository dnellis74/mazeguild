import { afterEach, describe, expect, it, vi } from "vitest";
import {
  combatPhases,
  runCombat,
  determineSurprise,
  establishPositions,
  rollInitiative,
  takeTurns,
  beginNextRound,
} from "./combat";
import { DYING_DEFAULTS, HIT_DICE_DEFAULTS, TRAIT_DEFAULTS, WEAR_DEFAULTS } from "./dyingDefaults";
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
    abilities: { STR: 14, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 10 },
    proficiencyBonus: 2,
    ac: 16,
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
    spellSlots: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
    ...over,
  };
}

function goblin(over: Partial<Combatant> = {}): Combatant {
  return pc({
    id: "gob",
    name: "Goblin",
    kind: "monster",
    archetype: "Monster",
    role: "dps",
    maxHp: 1,
    hp: 1,
    ac: 5,
    ...over,
  });
}

describe("SRD combat phase structure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports all five phase functions", () => {
    expect(typeof determineSurprise).toBe("function");
    expect(typeof establishPositions).toBe("function");
    expect(typeof rollInitiative).toBe("function");
    expect(typeof takeTurns).toBe("function");
    expect(typeof beginNextRound).toBe("function");
    expect(combatPhases.determineSurprise).toBe(determineSurprise);
    expect(combatPhases.establishPositions).toBe(establishPositions);
    expect(combatPhases.rollInitiative).toBe(rollInitiative);
    expect(combatPhases.takeTurns).toBe(takeTurns);
    expect(combatPhases.beginNextRound).toBe(beginNextRound);
  });

  it("calls the five phases in SRD order for one combat", () => {
    const calls: string[] = [];
    const spy = (name: keyof typeof combatPhases) => {
      const original = combatPhases[name];
      vi.spyOn(combatPhases, name).mockImplementation(
        ((...args: unknown[]) => {
          calls.push(name);
          return (original as (...a: unknown[]) => unknown)(...args);
        }) as typeof original,
      );
    };
    spy("determineSurprise");
    spy("establishPositions");
    spy("beginNextRound");
    spy("rollInitiative");
    spy("takeTurns");

    const hero = pc({ id: "hero", name: "Hero" });
    const foe = goblin({ id: "gob", name: "Goblin", maxHp: 1, hp: 1, ac: 5 });
    const log: LogEvent[] = [];
    // High inits / hit so the fight ends in one round.
    let i = 0;
    const seq = [0.9, 0.1, 0.95, 0.9];
    const rng = () => (i < seq.length ? seq[i++]! : 0.5);

    runCombat(rng, [hero], [foe], log);

    expect(calls[0]).toBe("determineSurprise");
    expect(calls[1]).toBe("establishPositions");
    // Round loop: beginNextRound → rollInitiative → takeTurns (possibly more)
    expect(calls[2]).toBe("beginNextRound");
    expect(calls[3]).toBe("rollInitiative");
    expect(calls[4]).toBe("takeTurns");
    // Closing beginNextRound sees the fight already over.
    expect(calls.at(-1)).toBe("beginNextRound");
    expect(calls.filter((c) => c === "determineSurprise")).toHaveLength(1);
    expect(calls.filter((c) => c === "establishPositions")).toHaveLength(1);
  });

  it("determineSurprise always returns an empty set (stub)", () => {
    expect(determineSurprise([], []).size).toBe(0);
  });
});
