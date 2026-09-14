import { describe, expect, it } from "vitest";
import { runCombat } from "./combat";
import type { Combatant, LogEvent, Weapon } from "./types";
import { DYING_DEFAULTS, HIT_DICE_DEFAULTS, TRAIT_DEFAULTS, WEAR_DEFAULTS } from "./dyingDefaults";
import { withSpellStatusOverrides } from "@/training/spellStatus";

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

    expect(log[0]).toMatchObject({
      event: "round_start",
      round: 1,
      order: ["wiz", "Goblin"],
    });

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
    // goblin wins init but is unconscious → no attack; wizard then hits and wakes.
    // Fire Bolt vs unconscious has advantage (two d20s); nat 20 still crits (ranged:
    // no unconscious auto-crit). Crit Fire Bolt rolls 2 damage dice.
    const seq = [
      0, // wiz init low
      0.95, // gob init high
      0.95, // Fire Bolt d20 a → 20
      0.1, // Fire Bolt d20 b (advantage)
      0.9, // crit damage die 1
      0.9, // crit damage die 2
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
    expect(wizHit).toMatchObject({
      event: "attack",
      hit: true,
      advantageMode: "advantage",
      used: "Fire Bolt",
    });
    expect(wizHit && "d20Rolls" in wizHit ? wizHit.d20Rolls : []).toHaveLength(
      2,
    );
    expect(wizHit && "d20" in wizHit ? wizHit.d20 : 0).toBe(20);
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
    withSpellStatusOverrides({ "Color Spray": "implemented" }, () => {
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
});

describe("runCombat Burning Hands / Thunderwave", () => {
  it("uses one shared damage roll; full on fail, half on success", () => {
    const wizard = pc({
      id: "wiz",
      saveSpell: "Burning Hands",
      spellSlots: 1,
      cantrip: "Fire Bolt",
      spellMod: 3,
      proficiencyBonus: 2,
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    });
    // DC = 8+2+3 = 13; DEX +0 for all → d20 < 13 fail, >= 13 success
    const a = goblin({
      id: "a",
      name: "A",
      maxHp: 40,
      hp: 40,
      abilities: { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const b = goblin({
      id: "b",
      name: "B",
      maxHp: 40,
      hp: 40,
      abilities: { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const c = goblin({
      id: "c",
      name: "C",
      maxHp: 40,
      hp: 40,
      abilities: { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const log: LogEvent[] = [];
    // wiz init; 3 foes init; 3d6 all 6 → 18; saves: fail(11), success(19), fail(5)
    const seq = [
      0.95, 0, 0, 0,
      0.9, 0.9, 0.9, // damage
      0.5, // A fail d20=11
      0.9, // B success d20=19
      0.2, // C fail d20=5
    ];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [a, b, c], log);

    const saves = log.filter(
      (e) => e.event === "save" && e.used === "Burning Hands",
    );
    expect(saves).toHaveLength(3);
    expect(saves.every((e) => e.event === "save" && e.damageFull === 18)).toBe(
      true,
    );
    const byName = Object.fromEntries(
      saves
        .filter((e) => e.event === "save")
        .map((e) => [e.target, e]),
    );
    expect(byName.A).toMatchObject({
      success: false,
      damage: 18,
      damageFull: 18,
    });
    expect(byName.B).toMatchObject({
      success: true,
      damage: 9,
      damageFull: 18,
    });
    expect(byName.C).toMatchObject({
      success: false,
      damage: 18,
      damageFull: 18,
    });
    expect(a.hp).toBe(22);
    expect(b.hp).toBe(31);
    expect(c.hp).toBe(22);
    expect(wizard.spellSlots).toBe(0);
  });

  it("logs Thunderwave push on a failed save", () => {
    const wizard = pc({
      id: "wiz",
      saveSpell: "Thunderwave",
      spellSlots: 1,
      cantrip: "Fire Bolt",
      spellMod: 3,
      proficiencyBonus: 2,
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    });
    const a = goblin({
      id: "a",
      name: "A",
      maxHp: 40,
      hp: 40,
      abilities: { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const b = goblin({
      id: "b",
      name: "B",
      maxHp: 40,
      hp: 40,
      abilities: { STR: 8, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    });
    const log: LogEvent[] = [];
    // DC 13 CON+0; 2d8=8+8=16; A fail, B success
    const seq = [0.95, 0, 0, 0.9, 0.9, 0.5, 0.9];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [wizard], [a, b], log);

    const saves = log.filter(
      (e) => e.event === "save" && e.used === "Thunderwave",
    );
    expect(saves).toHaveLength(2);
    expect(saves[0]).toMatchObject({
      target: "A",
      success: false,
      pushed: true,
      damageFull: 16,
      damage: 16,
    });
    expect(saves[1]).toMatchObject({
      target: "B",
      success: true,
      damage: 8,
    });
    expect(
      saves[1] && "pushed" in saves[1] ? saves[1].pushed : undefined,
    ).toBeUndefined();
  });

  it("cannot cast Burning Hands with 0 spell slots", () => {
    const wizard = pc({
      id: "wiz",
      saveSpell: "Burning Hands",
      spellSlots: 0,
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

    expect(log.some((e) => e.event === "save")).toBe(false);
    expect(wizard.spellSlots).toBe(0);
  });
});

describe("runCombat Rage resistance", () => {
  it("enters Rage via bonus action then resists weapon damage", () => {
    const barb = pc({
      id: "barb",
      archetype: "Barbarian",
      hp: 30,
      maxHp: 30,
      ragesRemaining: 2,
      rageDamage: 2,
      abilities: { STR: 16, DEX: 18, CON: 14, INT: 8, WIS: 10, CHA: 8 },
    });
    const foe = goblin({
      abilities: { STR: 18, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      maxHp: 100,
      hp: 100,
      weapon: {
        name: "Scimitar",
        damage: { count: 1, sides: 6 },
        damageType: "slashing",
        properties: [],
        finesse: false,
        ranged: false,
      },
    });
    const log: LogEvent[] = [];
    // One round: barb Rage (bonus) + crit kill; foe never acts.
    // Avoid multi-round fights (1-minute Rage expiry would re-enter and spend a 2nd use).
    const seq = [
      0.95, // barb init
      0, // foe init
      0.95, // barb d20 crit
      0.9, // damage die high (+STR + rage) kills hp 100? need enough — use lower foe hp
    ];
    // Lower foe HP so one hit ends the fight
    foe.maxHp = 8;
    foe.hp = 8;
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [barb], [foe], log);

    const r1 = log.filter(
      (e) =>
        "round" in e &&
        e.round === 1 &&
        ((e.event === "rage" && e.actor === "barb") ||
          (e.event === "attack" && e.actor === "barb")),
    );
    expect(r1[0]).toMatchObject({ event: "rage", used: "Rage" });
    expect(r1[1]?.event).toBe("attack");
    expect(barb.ragesRemaining).toBe(1);
    expect(barb.raging).toBe(false); // cleared at encounter end
  });

  it("resists slashing while raging after bonus-action entry", () => {
    const barb = pc({
      id: "barb",
      archetype: "Barbarian",
      hp: 30,
      maxHp: 30,
      ragesRemaining: 2,
      rageDamage: 2,
      abilities: { STR: 16, DEX: 18, CON: 14, INT: 8, WIS: 10, CHA: 8 },
    });
    const foe = goblin({
      abilities: { STR: 18, DEX: 10, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      maxHp: 100,
      hp: 100,
      weapon: {
        name: "Scimitar",
        damage: { count: 1, sides: 6 },
        damageType: "slashing",
        properties: [],
        finesse: false,
        ranged: false,
      },
    });
    const log: LogEvent[] = [];
    // Round 1: rage + miss; foe hits for 5 → 2 resisted. Then stop via high foe AC / we only check first hit.
    const seq = [
      0.95, 0, 0.1, 0.5, 0.45, 0.0,
      // round 2+: barb crits to end fight before rage minute expires
      0.95, 0, 0.95, 0.9,
    ];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.95);

    runCombat(rng, [barb], [foe], log);

    const hit = log.find(
      (e) =>
        e.event === "attack" &&
        e.actor === "Goblin" &&
        e.target === "barb" &&
        e.hit === true,
    );
    expect(hit).toMatchObject({ damage: 2 });
  });
});

describe("runCombat Bless integration", () => {
  it("logs a Bless buff on cast when the cleric has ≥2 allies", () => {
    const cleric = pc({
      id: "clr",
      archetype: "Cleric",
      buffSpell: "Bless",
      spellSlots: 1,
      cantrip: "Sacred Flame",
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 10, WIS: 16, CHA: 10 },
    });
    const ally = pc({
      id: "ally",
      archetype: "Fighter",
      abilities: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 8 },
    });
    const foe = goblin({ maxHp: 3, hp: 3 });
    const log: LogEvent[] = [];
    const seq = [0.95, 0.5, 0];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [cleric, ally], [foe], log);

    const buff = log.find((e) => e.event === "buff" && e.used === "Bless");
    expect(buff).toMatchObject({
      event: "buff",
      used: "Bless",
    });
    expect(buff && "affected" in buff ? [...buff.affected].sort() : []).toEqual(
      ["ally", "clr"],
    );
    expect(cleric.spellSlots).toBe(0);
  });
});

describe("runCombat Guiding Bolt / heals", () => {
  it("Guiding Bolt hits, deals radiant damage, applies guided, and spends a slot", () => {
    const cleric = pc({
      id: "clr",
      archetype: "Cleric",
      attackSpell: "Guiding Bolt",
      spellSlots: 1,
      spellMod: 3,
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 10, WIS: 16, CHA: 10 },
    });
    const foe = goblin({ ac: 5, maxHp: 8, hp: 8 });
    const log: LogEvent[] = [];
    // cleric init, goblin init, d20 hit, 4d6 all 6s
    const seq = [0.99, 0.5, 0.7, 0.9, 0.9, 0.9, 0.9];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [cleric], [foe], log);

    const atk = log.find(
      (e) => e.event === "attack" && e.used === "Guiding Bolt",
    );
    expect(atk).toMatchObject({
      event: "attack",
      hit: true,
      used: "Guiding Bolt",
    });
    expect(atk && "damage" in atk ? atk.damage : 0).toBe(24);
    expect(foe.condition?.name).toBe("guided");
    expect(cleric.spellSlots).toBe(0);
  });

  it("logs Healing Word as bonus heal and still takes an action attack same turn", () => {
    const healer = pc({
      id: "clr",
      archetype: "Cleric",
      role: "healer",
      healSlots: 0,
      healSpell: "Cure Wounds",
      bonusHealSpell: "Healing Word",
      healDice: { count: 1, sides: 8 },
      spellSlots: 2,
      spellMod: 3,
      cantrip: "Sacred Flame",
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 10, WIS: 16, CHA: 10 },
    });
    const ally = pc({
      id: "ally",
      archetype: "Fighter",
      hp: 2,
      maxHp: 10,
    });
    // High AC so action may miss; we only need the attack log event.
    const foe = goblin({ maxHp: 50, hp: 50, ac: 20 });
    const log: LogEvent[] = [];
    // inits: clr, ally, gob; HW heal die; then action attack d20 (+maybe more)
    const seq = [0.99, 0.5, 0.4, 0.75, 0.2];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [healer, ally], [foe], log);

    const round1 = log.filter(
      (e) =>
        (e.event === "heal" || e.event === "attack") &&
        "round" in e &&
        e.round === 1 &&
        e.actor === "clr",
    );
    expect(round1[0]).toMatchObject({
      event: "heal",
      used: "Healing Word",
      target: "ally",
    });
    expect(round1[1]).toMatchObject({
      event: "attack",
      actor: "clr",
      used: "Sacred Flame",
    });
    expect(healer.spellSlots).toBeLessThan(2);
  });

  it("Cure-only Cleric has no bonus heal and uses one action-slot heal", () => {
    const healer = pc({
      id: "clr",
      archetype: "Cleric",
      role: "healer",
      healSlots: 1,
      healSpell: "Cure Wounds",
      healDice: { count: 1, sides: 8 },
      spellMod: 3,
      spellSlots: 1,
      cantrip: "Sacred Flame",
    });
    const ally = pc({
      id: "ally",
      archetype: "Fighter",
      hp: 2,
      maxHp: 10,
    });
    const foe = goblin({ maxHp: 1, hp: 1, ac: 20 });
    const log: LogEvent[] = [];
    const seq = [0.99, 0.5, 0.5];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [healer, ally], [foe], log);

    const heals = log.filter((e) => e.event === "heal");
    expect(heals).toHaveLength(1);
    expect(heals[0]).toMatchObject({ event: "heal", used: "Cure Wounds" });
    expect(log.some((e) => e.event === "heal" && e.used === "Healing Word")).toBe(
      false,
    );
  });

  it("skips bonus heal with no wounded ally and still takes an action", () => {
    const healer = pc({
      id: "clr",
      archetype: "Cleric",
      bonusHealSpell: "Healing Word",
      spellSlots: 2,
      cantrip: "Sacred Flame",
      hp: 8,
      maxHp: 8,
      abilities: { STR: 8, DEX: 18, CON: 12, INT: 10, WIS: 16, CHA: 10 },
    });
    const foe = goblin({ maxHp: 3, hp: 3, ac: 5 });
    const log: LogEvent[] = [];
    const seq = [0.99, 0.5, 0.7, 0.5];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [healer], [foe], log);

    expect(log.some((e) => e.event === "heal")).toBe(false);
    expect(
      log.some(
        (e) => e.event === "attack" && e.actor === "clr" && e.used === "Sacred Flame",
      ),
    ).toBe(true);
    expect(healer.spellSlots).toBe(2);
  });
});

describe("runCombat Second Wind", () => {
  it("heals via bonus action then still takes an action attack", () => {
    const fighter = pc({
      id: "ftr",
      archetype: "Fighter",
      role: "tank",
      secondWindAvailable: true,
      secondWindLevel: 1,
      hp: 4,
      maxHp: 12,
      abilities: { STR: 16, DEX: 18, CON: 14, INT: 8, WIS: 10, CHA: 8 },
    });
    const foe = goblin({ maxHp: 3, hp: 3, ac: 5 });
    const log: LogEvent[] = [];
    // ftr init, foe init, Second Wind d10=5 → heal 6; attack d20 + damage
    const seq = [0.99, 0.4, 0.4, 0.7, 0.5];
    let i = 0;
    const rng = () => (i < seq.length ? seq[i++]! : 0.1);

    runCombat(rng, [fighter], [foe], log);

    const r1 = log.filter(
      (e) =>
        "round" in e &&
        e.round === 1 &&
        ((e.event === "heal" && e.actor === "ftr") ||
          (e.event === "attack" && e.actor === "ftr")),
    );
    expect(r1[0]).toMatchObject({
      event: "heal",
      used: "Second Wind",
      target: "ftr",
      amount: 6,
    });
    expect(r1[1]?.event).toBe("attack");
    expect(fighter.secondWindAvailable).toBe(false);
  });
});
