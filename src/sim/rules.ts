import { d, dice, type Rng } from "./rng";
import type { Ability, Combatant } from "./types";

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

export type AttackResult = {
  hit: boolean;
  crit: boolean;
  damage: number;
  d20: number;
  total: number;
};

/**
 * SRD 5.1 attack: d20 + ability mod + proficiency vs AC.
 * Natural 20 always hits and doubles weapon dice. Natural 1 always misses.
 * Halfling Lucky rerolls a natural 1 on the d20 (once).
 */
export function resolveAttack(
  rng: Rng,
  attacker: Combatant,
  defender: Combatant,
  allyCount: number,
): AttackResult {
  let d20 = d(rng, 20);
  if (attacker.lucky && d20 === 1) d20 = d(rng, 20);

  const abi = attackAbility(attacker);
  const bonus = abilityMod(attacker.abilities[abi]) + attacker.proficiencyBonus;
  const total = d20 + bonus;
  const crit = d20 === 20;
  const nat1 = d20 === 1;
  const hit = crit || (!nat1 && total >= defender.ac);

  if (!hit) return { hit: false, crit: false, damage: 0, d20, total };

  const die = attacker.weapon.damage;
  const dieCount = crit ? die.count * 2 : die.count;
  let damage =
    dice(rng, dieCount, die.sides) + abilityMod(attacker.abilities[abi]);

  if (attacker.sneakAttackDice > 0 && allyCount > 0) {
    const sa = crit ? attacker.sneakAttackDice * 2 : attacker.sneakAttackDice;
    damage += dice(rng, sa, 6);
  }

  return { hit: true, crit, damage: Math.max(0, damage), d20, total };
}

/** Cure Wounds: 1d8 + spellcasting modifier. */
export function resolveCureWounds(rng: Rng, healer: Combatant): number {
  return Math.max(
    1,
    dice(rng, healer.healDice.count, healer.healDice.sides) + healer.spellMod,
  );
}

export function applyDamage(target: Combatant, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
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
