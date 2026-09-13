import { d, dice, type Rng } from "./rng";
import { getCantrip } from "./cantrips";
import type { SpellEntry } from "./spells";
import type { Ability, Combatant, ConditionName } from "./types";

/** SRD 5.1 ability modifier. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function attackAbility(c: Combatant): Ability {
  if (c.weapon.ranged) return "DEX";
  if (c.weapon.finesse) {
    return c.abilities.DEX >= c.abilities.STR ? "DEX" : "STR";
  }
  return "STR";
}

/** Net attack-roll mode after advantage and disadvantage cancel. */
export type AdvantageMode = "none" | "advantage" | "disadvantage";

export type D20Roll = {
  d20: number;
  mode: AdvantageMode;
  /** Raw dice before Lucky; length 1 (normal/cancel) or 2 (adv/disadv). */
  rolls: number[];
};

/**
 * Combine boolean adv/disadv flags. Both → cancel (single roll).
 */
export function resolveAdvantageMode(
  advantage: boolean,
  disadvantage: boolean,
): AdvantageMode {
  if (advantage && disadvantage) return "none";
  if (advantage) return "advantage";
  if (disadvantage) return "disadvantage";
  return "none";
}

/**
 * Attack-roll sources for this pass: only blinded.
 * Blinded attacker → disadvantage; attacks against blinded → advantage.
 */
export function attackRollMode(
  attacker: Combatant,
  defender: Combatant,
): AdvantageMode {
  const adv = hasCondition(defender, "blinded");
  const disadv = hasCondition(attacker, "blinded");
  return resolveAdvantageMode(adv, disadv);
}

/**
 * SRD d20 with advantage / disadvantage / cancel, then Halfling Lucky on the kept die.
 */
export function rollD20(
  rng: Rng,
  opts: { mode?: AdvantageMode; lucky?: boolean } = {},
): D20Roll {
  const mode = opts.mode ?? "none";
  if (mode === "none") {
    const a = d(rng, 20);
    let kept = a;
    if (opts.lucky && kept === 1) kept = d(rng, 20);
    return { d20: kept, mode, rolls: [a] };
  }
  const a = d(rng, 20);
  const b = d(rng, 20);
  let kept = mode === "advantage" ? Math.max(a, b) : Math.min(a, b);
  if (opts.lucky && kept === 1) kept = d(rng, 20);
  return { d20: kept, mode, rolls: [a, b] };
}

export type AttackResult = {
  hit: boolean;
  crit: boolean;
  damage: number;
  d20: number;
  total: number;
  advantageMode?: AdvantageMode;
};

export type AutoSpellResult = {
  damage: number;
};

export type HpPoolResult = {
  pool: number;
  affected: Combatant[];
};

/**
 * Auto-hit spell (combatType "auto"): no attack roll, no crit, no miss, no Lucky,
 * no Sneak Attack. Rolls each damage instance separately (per) and adds bonus per instance.
 */
export function resolveAutoSpell(
  rng: Rng,
  spell: SpellEntry,
): AutoSpellResult {
  const die = spell.damage;
  if (!die) return { damage: 0 };
  const per = Math.max(1, die.per ?? 1);
  const bonus = die.bonus ?? 0;
  let damage = 0;
  for (let i = 0; i < per; i++) {
    damage += dice(rng, die.count, die.sides) + bonus;
  }
  return { damage: Math.max(0, damage) };
}

/**
 * Sleep / Color Spray-style HP pool: roll pool dice, sort living eligible foes by
 * ascending current HP, spend the pool on full HP only; stop at the first that
 * does not fit (do not skip ahead to a later lower-HP creature).
 */
export function resolveHpPool(
  rng: Rng,
  spell: SpellEntry,
  foes: Combatant[],
): HpPoolResult {
  const die = spell.pool;
  if (!die) return { pool: 0, affected: [] };
  const pool = dice(rng, die.count, die.sides);
  const exclude = new Set((spell.exclude || []).map((e) => e.toLowerCase()));

  const eligible = foes
    .filter((f) => f.alive)
    .filter((f) => f.condition?.name !== "unconscious")
    .filter((f) => !(spell.ignoreCantSee && f.condition?.name === "blinded"))
    .filter((f) => {
      const t = (f.creatureType || "humanoid").toLowerCase();
      return !exclude.has(t);
    })
    .sort((a, b) => a.hp - b.hp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  let remaining = pool;
  const affected: Combatant[] = [];
  for (const foe of eligible) {
    if (foe.hp > remaining) break;
    remaining -= foe.hp;
    affected.push(foe);
  }
  return { pool, affected };
}

export function setCondition(
  target: Combatant,
  name: ConditionName,
  expiresRound: number,
): void {
  target.condition = { name, expiresRound };
}

export function clearCondition(target: Combatant): void {
  target.condition = null;
}

export function expireConditionIfDue(actor: Combatant, round: number): void {
  if (actor.condition && round >= actor.condition.expiresRound) {
    actor.condition = null;
  }
}

export function hasCondition(c: Combatant, name: ConditionName): boolean {
  return c.condition?.name === name;
}

/**
 * SRD 5.1 attack: d20 + ability mod + proficiency vs AC.
 * Natural 20 always hits and doubles weapon/cantrip dice. Natural 1 always misses.
 * Halfling Lucky rerolls a natural 1 on the kept d20 (once).
 * Advantage/disadvantage: blinded only for now (see attackRollMode).
 *
 * With an assigned attack cantrip: spell attack (prof + spellMod), cantrip dice,
 * no ability mod on damage (SRD cantrips in this set are dice-only), no Sneak Attack.
 * Weapon attacks: existing STR/DEX path; Sneak Attack only on finesse or ranged weapons.
 */
export function resolveAttack(
  rng: Rng,
  attacker: Combatant,
  defender: Combatant,
  allyCount: number,
): AttackResult {
  const cantrip =
    attacker.cantrip && attacker.kind === "pc"
      ? getCantrip(attacker.cantrip)
      : undefined;
  const useCantrip =
    !!cantrip && cantrip.combatType === "attack" && !!cantrip.damage;

  const mode = attackRollMode(attacker, defender);
  const { d20 } = rollD20(rng, { mode, lucky: attacker.lucky });

  const bonus = useCantrip
    ? attacker.spellMod + attacker.proficiencyBonus
    : abilityMod(attacker.abilities[attackAbility(attacker)]) +
      attacker.proficiencyBonus;
  const total = d20 + bonus;
  const crit = d20 === 20;
  const nat1 = d20 === 1;
  const ac = defender.ac + (defender.tempAcBonus || 0);
  const hit = crit || (!nat1 && total >= ac);

  if (!hit) {
    return {
      hit: false,
      crit: false,
      damage: 0,
      d20,
      total,
      advantageMode: mode,
    };
  }

  if (useCantrip) {
    const die = cantrip!.damage!;
    const dieCount = crit ? die.count * 2 : die.count;
    // SRD attack cantrips in this data set are dice-only (no ability mod on damage).
    const damage = dice(rng, dieCount, die.sides);
    return {
      hit: true,
      crit,
      damage: Math.max(0, damage),
      d20,
      total,
      advantageMode: mode,
    };
  }

  const abi = attackAbility(attacker);
  const die = attacker.weapon.damage;
  const dieCount = crit ? die.count * 2 : die.count;
  let damage =
    dice(rng, dieCount, die.sides) + abilityMod(attacker.abilities[abi]);

  // Sneak Attack requires a finesse or ranged weapon attack (SRD), not a spell attack.
  const weaponOk = attacker.weapon.finesse || attacker.weapon.ranged;
  if (attacker.sneakAttackDice > 0 && allyCount > 0 && weaponOk) {
    const sa = crit ? attacker.sneakAttackDice * 2 : attacker.sneakAttackDice;
    damage += dice(rng, sa, 6);
  }

  return {
    hit: true,
    crit,
    damage: Math.max(0, damage),
    d20,
    total,
    advantageMode: mode,
  };
}

/** Cure Wounds: 1d8 + spellcasting modifier. */
export function resolveCureWounds(rng: Rng, healer: Combatant): number {
  return Math.max(
    1,
    dice(rng, healer.healDice.count, healer.healDice.sides) + healer.spellMod,
  );
}

/** Spell save DC: 8 + proficiency + spellcasting modifier. */
export function spellSaveDC(caster: Combatant): number {
  return 8 + caster.proficiencyBonus + caster.spellMod;
}

export type SaveResult = {
  success: boolean;
  d20: number;
  total: number;
  dc: number;
  /** Damage applied after onSuccess handling. */
  damage: number;
  damageFull: number;
  pushed: boolean;
};

/**
 * Ability saving throw vs caster's spell save DC.
 * Roll: d20 + ability modifier only (no save proficiency — Combatant has none).
 * Shared damageFull is reduced to half (floor) or 0 on success per onSuccess.
 */
export function resolveSave(
  rng: Rng,
  caster: Combatant,
  defender: Combatant,
  opts: {
    ability: Ability;
    onSuccess: "half" | "none";
    damageFull: number;
    /** Thunderwave: push on a failed save (logged; no position model). */
    pushOnFail?: boolean;
  },
): SaveResult {
  const dc = spellSaveDC(caster);
  const d20 = d(rng, 20);
  const total = d20 + abilityMod(defender.abilities[opts.ability]);
  const success = total >= dc;
  let damage = opts.damageFull;
  if (success) {
    damage =
      opts.onSuccess === "half" ? Math.floor(opts.damageFull / 2) : 0;
  }
  return {
    success,
    d20,
    total,
    dc,
    damage,
    damageFull: opts.damageFull,
    pushed: !success && !!opts.pushOnFail,
  };
}

/** Roll AoE spell damage once (shared across all targets in the blast). */
export function rollSpellDamage(rng: Rng, spell: SpellEntry): number {
  const die = spell.damage;
  if (!die) return 0;
  return dice(rng, die.count, die.sides);
}

export function applyDamage(target: Combatant, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
  // Sleep: taking any damage wakes the sleeper (SRD).
  if (amount > 0 && target.condition?.name === "unconscious") {
    clearCondition(target);
  }
  if (target.hp === 0 && target.relentless && !target.relentlessUsed) {
    target.hp = 1;
    target.relentlessUsed = true;
    return;
  }
  if (target.hp === 0) target.alive = false;
}

export function applyHeal(target: Combatant, amount: number): void {
  if (!target.alive) return;
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

export function applyXp(target: Combatant, amount: number): void {
  if (!target.alive) return;
  target.xp += amount;
}
