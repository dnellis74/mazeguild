import { describe, expect, it } from "vitest";
import { runCombat } from "./combat";
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
    spellSlots: 0,
    spellMod: 3,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 0,
    ...over,
  };
}

function goblin(): Combatant {
  return {
    id: "gob",
    name: "Goblin",
    kind: "monster",
    archetype: "Monster",
    race: "Monster",
    role: "dps",
    abilities: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    proficiencyBonus: 2,
    ac: 15,
    maxHp: 50,
    hp: 50,
    alive: true,
    weapon: CLUB,
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
    xpValue: 50,
  };
}

describe("runCombat Magic Missile", () => {
  it("casts Magic Missile with no miss, deals damage, and spends a slot", () => {
    const wizard = pc({
      id: "wiz",
      spell: "Magic Missile",
      spellSlots: 2,
      cantrip: "Fire Bolt",
    });
    const foe = goblin();
    const log: LogEvent[] = [];
    // High init for wizard, then three d4s for missiles.
    const rng = (() => {
      const seq = [0.99, 0.25, 0.5, 0.75];
      let i = 0;
      return () => (i < seq.length ? seq[i++]! : 0.1);
    })();

    runCombat(rng, [wizard], [foe], log);

    const mm = log.find(
      (e) => e.event === "attack" && e.used === "Magic Missile",
    );
    expect(mm).toMatchObject({
      event: "attack",
      hit: true,
      crit: false,
      used: "Magic Missile",
    });
    expect(mm && "damage" in mm ? mm.damage : 0).toBeGreaterThanOrEqual(6);
    expect(wizard.spellSlots).toBeLessThan(2);
    expect(foe.hp).toBeLessThan(50);
  });

  it("does not cast Magic Missile when the spell was never learned", () => {
    const wizard = pc({
      id: "wiz",
      spellSlots: 2,
      cantrip: "Fire Bolt",
    });
    const foe = goblin();
    const log: LogEvent[] = [];
    const rng = (() => {
      let n = 0;
      return () => {
        n += 1;
        return n % 2 === 0 ? 0.99 : 0.1;
      };
    })();

    runCombat(rng, [wizard], [foe], log);

    expect(
      log.some((e) => e.event === "attack" && e.used === "Magic Missile"),
    ).toBe(false);
    expect(wizard.spellSlots).toBe(2);
    expect(
      log.some((e) => e.event === "attack" && e.used === "Fire Bolt"),
    ).toBe(true);
  });
});
