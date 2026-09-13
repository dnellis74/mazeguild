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
    reactionUsed: false,
    tempAcBonus: 0,
    condition: null,
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

function goblin(over: Partial<Combatant> = {}): Combatant {
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
    reactionUsed: false,
    tempAcBonus: 0,
    condition: null,
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellSlots: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: 50,
    ...over,
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

describe("runCombat Shield reaction", () => {
  it("turns a hit into a miss when Shield + slot are available", () => {
    const wizard = pc({
      id: "wiz",
      ac: 12,
      hp: 20,
      maxHp: 20,
      reactionSpell: "Shield",
      spellSlots: 1,
      cantrip: "Fire Bolt",
    });
    const foe = goblin({
      abilities: { STR: 18, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      maxHp: 3,
      hp: 3,
    });
    const log: LogEvent[] = [];
    // party rolls init first: wiz nat1 (+2→3), gob nat20; enemy target pick;
    // attack d20=8 → total 14 (hits AC 12, misses AC 17)
    const seq = [0, 0.95, 0.5, 0.35];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [foe], log);

    const blocked = log.find(
      (e) =>
        e.event === "attack" &&
        e.target === "wiz" &&
        e.reaction === "Shield",
    );
    expect(blocked).toMatchObject({ hit: false, reaction: "Shield" });
    expect(wizard.spellSlots).toBe(0);
    expect(wizard.hp).toBe(20);
    // Bonus ends at the start of the wizard's next turn (beginTurn).
    expect(wizard.tempAcBonus).toBe(0);
  });

  it("does not spend a slot when +5 would not change the hit", () => {
    const wizard = pc({
      id: "wiz",
      ac: 12,
      hp: 20,
      maxHp: 20,
      reactionSpell: "Shield",
      spellSlots: 1,
      cantrip: "Fire Bolt",
    });
    const foe = goblin({
      abilities: { STR: 18, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      maxHp: 100,
      hp: 100,
    });
    const log: LogEvent[] = [];
    // wiz init low, gob high; target pick; attack d20=18 → total 24 (still hits AC 17)
    const seq = [0, 0.95, 0.5, 0.85, 0.5];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [foe], log);

    const hit = log.find(
      (e) => e.event === "attack" && e.target === "wiz" && e.hit === true,
    );
    expect(hit).toBeTruthy();
    expect(hit && "reaction" in hit ? hit.reaction : undefined).toBeUndefined();
    expect(wizard.spellSlots).toBe(1);
    expect(wizard.hp).toBeLessThan(20);
  });

  it("cannot react with 0 spell slots", () => {
    const wizard = pc({
      id: "wiz",
      ac: 12,
      hp: 20,
      maxHp: 20,
      reactionSpell: "Shield",
      spellSlots: 0,
      cantrip: "Fire Bolt",
    });
    const foe = goblin({
      abilities: { STR: 18, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      maxHp: 100,
      hp: 100,
    });
    const log: LogEvent[] = [];
    const seq = [0, 0.95, 0.5, 0.35, 0.5];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [foe], log);

    const atk = log.find(
      (e) => e.event === "attack" && e.target === "wiz",
    );
    expect(atk).toMatchObject({ hit: true });
    expect(atk && "reaction" in atk ? atk.reaction : undefined).toBeUndefined();
    expect(wizard.hp).toBeLessThan(20);
  });

  it("never reacts when Shield is not learned", () => {
    const wizard = pc({
      id: "wiz",
      ac: 12,
      hp: 20,
      maxHp: 20,
      spellSlots: 1,
      cantrip: "Fire Bolt",
    });
    const foe = goblin({
      abilities: { STR: 18, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      maxHp: 100,
      hp: 100,
    });
    const log: LogEvent[] = [];
    const seq = [0, 0.95, 0.5, 0.35, 0.5];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [foe], log);

    const atk = log.find(
      (e) => e.event === "attack" && e.target === "wiz",
    );
    expect(atk).toMatchObject({ hit: true });
    expect(atk && "reaction" in atk ? atk.reaction : undefined).toBeUndefined();
    expect(wizard.spellSlots).toBe(1);
  });
});

describe("runCombat Sleep", () => {
  it("puts two low-HP foes to sleep and leaves a higher-HP foe awake", () => {
    const wizard = pc({
      id: "wiz",
      controlSpell: "Sleep",
      spellSlots: 1,
      cantrip: "Fire Bolt",
      // High DEX so wizard acts first after init bias
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    });
    const a = goblin({ id: "a", name: "A", maxHp: 3, hp: 3 });
    const b = goblin({ id: "b", name: "B", maxHp: 4, hp: 4 });
    const c = goblin({
      id: "c",
      name: "C",
      maxHp: 20,
      hp: 20,
      abilities: { STR: 8, DEX: 8, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const log: LogEvent[] = [];
    // wiz init high; three goblins low; then 5× d8=2 → pool 10
    const seq = [
      0.95, // wiz init
      0, 0, 0, // a,b,c init
      0.125, 0.125, 0.125, 0.125, 0.125, // Sleep pool
    ];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [a, b, c], log);

    const ctrl = log.find((e) => e.event === "control" && e.used === "Sleep");
    expect(ctrl).toMatchObject({
      event: "control",
      used: "Sleep",
      pool: 10,
      affected: ["A", "B"],
    });
    expect(wizard.spellSlots).toBe(0);
    // C was never covered (pool stopped); A/B may wake later if damaged.
    expect(c.condition).toBeNull();
    expect(
      log.some(
        (e) =>
          e.event === "control" &&
          e.used === "Sleep" &&
          e.affected.includes("C"),
      ),
    ).toBe(false);
  });

  it("skips an unconscious foe's actions until damage wakes them", () => {
    const wizard = pc({
      id: "wiz",
      hp: 20,
      maxHp: 20,
      cantrip: "Fire Bolt",
      abilities: { STR: 8, DEX: 8, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    });
    const sleeper = goblin({
      id: "gob",
      name: "Goblin",
      maxHp: 7,
      hp: 7,
      abilities: { STR: 18, DEX: 18, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      condition: { name: "unconscious", expiresRound: 99 },
    });
    const log: LogEvent[] = [];
    // goblin wins init but is unconscious → no attack; wizard then hits and wakes
    const seq = [
      0, // wiz init low
      0.95, // gob init high
      0.95, // wiz Fire Bolt attack (crit)
      0.5, // damage die
    ];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [sleeper], log);

    const gobAttacks = log.filter(
      (e) => e.event === "attack" && e.actor === "Goblin",
    );
    expect(gobAttacks).toHaveLength(0);
    const wizHit = log.find(
      (e) => e.event === "attack" && e.actor === "wiz" && e.hit === true,
    );
    expect(wizHit).toBeTruthy();
    // Woken by damage (may still be alive or dead depending on damage)
    if (sleeper.alive) {
      expect(sleeper.condition).toBeNull();
    }
  });

  it("never casts Sleep when the wizard has not learned it", () => {
    const wizard = pc({
      id: "wiz",
      spellSlots: 2,
      cantrip: "Fire Bolt",
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    });
    const foes = [
      goblin({ id: "a", name: "A", maxHp: 3, hp: 3 }),
      goblin({ id: "b", name: "B", maxHp: 3, hp: 3 }),
    ];
    const log: LogEvent[] = [];
    const seq = [0.95, 0, 0];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], foes, log);

    expect(log.some((e) => e.event === "control")).toBe(false);
    expect(wizard.spellSlots).toBe(2);
  });
});

describe("runCombat Color Spray", () => {
  it("blinds foes covered by the pool", () => {
    const wizard = pc({
      id: "wiz",
      controlSpell: "Color Spray",
      spellSlots: 1,
      cantrip: "Fire Bolt",
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    });
    const a = goblin({ id: "a", name: "A", maxHp: 3, hp: 3 });
    const b = goblin({ id: "b", name: "B", maxHp: 4, hp: 4 });
    const c = goblin({
      id: "c",
      name: "C",
      maxHp: 50,
      hp: 50,
      abilities: { STR: 8, DEX: 8, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const log: LogEvent[] = [];
    // wiz init high; 6× d10=2 → pool 12 covers A+B, not C
    const seq = [
      0.95, 0, 0, 0,
      0.1, 0.1, 0.1, 0.1, 0.1, 0.1,
    ];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [a, b, c], log);

    const ctrl = log.find(
      (e) => e.event === "control" && e.used === "Color Spray",
    );
    expect(ctrl).toMatchObject({
      used: "Color Spray",
      pool: 12,
      affected: ["A", "B"],
    });
    expect(wizard.spellSlots).toBe(0);
  });
});
