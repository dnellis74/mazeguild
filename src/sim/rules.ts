import type {
  Ability,
  Combatant,
  ConditionName,
  RollModifier,
} from "./types";
import type { Rng } from "./rng";
import { d, dice, diceRerollLow } from "./rng";
import { getCantrip } from "./cantrips";
import { getSpell, type SpellEntry } from "./spells";

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
 * Attack-roll advantage sources:
 * - blinded defender → advantage (persists until expiry)
 * - guided defender → advantage (consumed on the next attack roll; see resolveAttack)
 * - blinded attacker → disadvantage
 */
export function attackRollMode(
  attacker: Combatant,
  defender: Combatant,
): AdvantageMode {
  const adv =
    hasCondition(defender, "blinded") || hasCondition(defender, "guided");
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

// --- Roll modifiers ---

/**
 * Add or replace a roll modifier by `source` (same source does not stack).
 */
export function addRollModifier(
  target: Combatant,
  modifier: RollModifier,
): void {
  target.rollModifiers = [
    ...target.rollModifiers.filter((m) => m.source !== modifier.source),
    modifier,
  ];
}

/** Remove a roll modifier by source string. */
export function removeRollModifier(target: Combatant, source: string): void {
  target.rollModifiers = target.rollModifiers.filter((m) => m.source !== source);
}

/**
 * Sum applicable modifier dice for an attack or save.
 * RNG order: each matching modifier's die is rolled in array order (after the d20).
 */
export function rollModifierBonus(
  rng: Rng,
  combatant: Combatant,
  kind: "attack" | "save",
): number {
  let sum = 0;
  for (const m of combatant.rollModifiers) {
    if (m.affects !== kind && m.affects !== "both") continue;
    sum += m.sign * dice(rng, m.die.count, m.die.sides);
  }
  return sum;
}

// --- Concentration ---

/** End concentration and run the spell's cleanup callback. */
export function endConcentration(caster: Combatant): void {
  const cur = caster.concentratingOn;
  if (!cur) return;
  caster.concentratingOn = null;
  cur.onEnd();
}

/**
 * Start concentrating on a spell. Ends any existing concentration first
 * (no save) so the previous spell's onEnd cleanup runs.
 */
export function startConcentration(
  caster: Combatant,
  spellName: string,
  startedRound: number,
  onEnd: () => void,
): void {
  // Can't concentrate while raging (SRD); defensive if a multiclass somehow rages.
  if (caster.raging) return;
  endConcentration(caster);
  caster.concentratingOn = { spellName, startedRound, onEnd };
}

/** Concentration save DC: max(10, floor(damageTaken / 2)). */
export function concentrationSaveDC(damageTaken: number): number {
  return Math.max(10, Math.floor(damageTaken / 2));
}

/**
 * CON save to maintain concentration after taking damage.
 * Returns true if concentration is kept. Ability mod only (+ save rollModifiers).
 * RNG: d20, then applicable save modifier dice in array order.
 */
export function checkConcentrationOnDamage(
  rng: Rng,
  caster: Combatant,
  damageTaken: number,
): boolean {
  if (!caster.concentratingOn || damageTaken <= 0) return true;
  const dc = concentrationSaveDC(damageTaken);
  const d20 = d(rng, 20);
  const total =
    d20 +
    abilityMod(caster.abilities.CON) +
    rollModifierBonus(rng, caster, "save");
  if (total >= dc) return true;
  endConcentration(caster);
  return false;
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
  // Incapacitated (unconscious) ends concentration and Rage immediately — no save.
  if (name === "unconscious") {
    endConcentration(target);
    if (target.raging) endRage(target);
  }
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
 * Natural 20 always hits and doubles weapon/cantrip/spell dice. Natural 1 always misses.
 * Halfling Lucky rerolls a natural 1 on the kept d20 (once).
 * Advantage/disadvantage: blinded (duration) + guided (consume-on-use) — see attackRollMode.
 * Roll modifiers (e.g. Bless): after d20, each applicable die in array order.
 *
 * With opts.spellAttack (leveled) or an assigned attack cantrip: spell attack
 * (prof + spellMod), that spell/cantrip's dice, no ability mod on damage, no Sneak Attack.
 * Weapon attacks: existing STR/DEX path; Sneak Attack only on finesse or ranged weapons.
 *
 * Guided: if the defender has guided when this attack roll is made, it grants
 * advantage for this roll and is then cleared (next-attack only). Blinded is not consumed.
 */
export function resolveAttack(
  rng: Rng,
  attacker: Combatant,
  defender: Combatant,
  allyCount: number,
  opts?: { spellAttack?: string },
): AttackResult {
  const leveledName = opts?.spellAttack;
  const leveled =
    leveledName && attacker.kind === "pc" ? getSpell(leveledName) : undefined;
  const useLeveled =
    !!leveled && leveled.combatType === "attack" && !!leveled.damage;

  const cantrip =
    !useLeveled && attacker.cantrip && attacker.kind === "pc"
      ? getCantrip(attacker.cantrip)
      : undefined;
  const useCantrip =
    !!cantrip && cantrip.combatType === "attack" && !!cantrip.damage;

  const useSpellAttack = useLeveled || useCantrip;
  const spellDie = useLeveled
    ? leveled!.damage!
    : useCantrip
      ? cantrip!.damage!
      : null;

  // Consume guided on the attack roll (hit or miss); blinded persists.
  const guided = hasCondition(defender, "guided");
  const mode = attackRollMode(attacker, defender);
  if (guided) clearCondition(defender);

  const { d20 } = rollD20(rng, { mode, lucky: attacker.lucky });
  const modBonus = rollModifierBonus(rng, attacker, "attack");

  const bonus = useSpellAttack
    ? attacker.spellMod + attacker.proficiencyBonus
    : abilityMod(attacker.abilities[attackAbility(attacker)]) +
      attacker.proficiencyBonus;
  // Archery: +2 to attack rolls with ranged weapons (weapon attacks only).
  const archeryBonus =
    !useSpellAttack && attacker.archery && attacker.weapon.ranged ? 2 : 0;
  const total = d20 + bonus + modBonus + archeryBonus;
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

  if (useSpellAttack && spellDie) {
    const dieCount = crit ? spellDie.count * 2 : spellDie.count;
    const damage = dice(rng, dieCount, spellDie.sides);
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
  // Great Weapon Fighting: melee Two-handed/Versatile — reroll 1s and 2s once.
  const gwf =
    attacker.greatWeaponFighting &&
    !attacker.weapon.ranged &&
    attacker.weapon.properties.some((p) =>
      /two-handed|versatile/i.test(p),
    );
  const weaponDice = gwf
    ? diceRerollLow(rng, dieCount, die.sides, 2)
    : dice(rng, dieCount, die.sides);
  let damage = weaponDice + abilityMod(attacker.abilities[abi]);

  // Rage: +Rage Damage on Strength melee weapon attacks (not DEX finesse, not ranged).
  if (
    attacker.raging &&
    abi === "STR" &&
    !attacker.weapon.ranged &&
    attacker.rageDamage > 0
  ) {
    damage += attacker.rageDamage;
  }

  // Sneak Attack (SRD): finesse or ranged weapon; once per turn; on a hit if
  // (advantage) OR (living ally proxy AND no disadvantage on this roll).
  // `mode` is the same AdvantageMode already used for the d20 above.
  const weaponOk = attacker.weapon.finesse || attacker.weapon.ranged;
  const sneakOk =
    attacker.sneakAttackDice > 0 &&
    !attacker.sneakAttackUsedThisTurn &&
    weaponOk &&
    (mode === "advantage" ||
      (allyCount > 0 && mode !== "disadvantage"));
  if (sneakOk) {
    const sa = crit ? attacker.sneakAttackDice * 2 : attacker.sneakAttackDice;
    damage += dice(rng, sa, 6);
    attacker.sneakAttackUsedThisTurn = true;
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

/**
 * Heal spell: healDice + spellcasting modifier (Cure Wounds 1d8 / Healing Word 1d4).
 */
export function resolveCureWounds(rng: Rng, healer: Combatant): number {
  return Math.max(
    1,
    dice(rng, healer.healDice.count, healer.healDice.sides) + healer.spellMod,
  );
}

/** Heal with explicit dice (e.g. Healing Word 1d4 while healDice stays Cure's 1d8). */
export function resolveHealAmount(
  rng: Rng,
  healer: Combatant,
  healDice: { count: number; sides: number },
): number {
  return Math.max(
    1,
    dice(rng, healDice.count, healDice.sides) + healer.spellMod,
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
 * Roll: d20 + ability modifier only (no save proficiency — Combatant has none),
 * then rollModifiers for "save"/"both" in array order.
 * Raging defenders have advantage on Strength saves.
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
  const mode: AdvantageMode =
    opts.ability === "STR" && defender.raging ? "advantage" : "none";
  const { d20 } = rollD20(rng, { mode });
  const modBonus = rollModifierBonus(rng, defender, "save");
  const total =
    d20 + abilityMod(defender.abilities[opts.ability]) + modBonus;
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

const RAGE_RESISTANCES = ["bludgeoning", "piercing", "slashing"] as const;

/**
 * Apply immunities / resistance / vulnerability to a raw damage amount.
 * Order: immunity → 0; else if both resist+vuln → cancel (normal); else
 * resist halves (floor) or vulnerability doubles. Multiple sources of the
 * same trait do not stack (membership in the array is enough once).
 */
export function modifyDamageByTraits(
  target: Combatant,
  amount: number,
  damageType: string,
): number {
  if (amount <= 0) return 0;
  const type = damageType.toLowerCase();
  if (target.immunities.some((t) => t.toLowerCase() === type)) return 0;
  const resist = target.resistances.some((t) => t.toLowerCase() === type);
  const vuln = target.vulnerabilities.some((t) => t.toLowerCase() === type);
  if (resist && vuln) return amount;
  if (resist) return Math.floor(amount / 2);
  if (vuln) return amount * 2;
  return amount;
}

/**
 * Reduce HP by amount after resistance/immunity/vulnerability for damageType.
 * Returns the actual HP lost (post-mitigation).
 * If `rng` is provided and the target is concentrating, rolls a concentration
 * save against the damage taken (separate call per damage instance).
 */
export function applyDamage(
  target: Combatant,
  amount: number,
  damageType: string,
  rng?: Rng,
): number {
  const applied = modifyDamageByTraits(target, amount, damageType);
  target.hp = Math.max(0, target.hp - applied);
  // Rage maintenance: any damage taken counts toward keeping Rage active.
  if (applied > 0 && target.raging) {
    target.rageMaintained = true;
  }
  // Sleep: taking any damage wakes the sleeper (SRD).
  if (applied > 0 && target.condition?.name === "unconscious") {
    clearCondition(target);
  }
  if (target.hp === 0 && target.relentless && !target.relentlessUsed) {
    target.hp = 1;
    target.relentlessUsed = true;
    if (rng && applied > 0) checkConcentrationOnDamage(rng, target, applied);
    return applied;
  }
  if (target.hp === 0) {
    target.alive = false;
    if (target.raging) endRage(target);
    // Dying ends concentration immediately — no save.
    endConcentration(target);
    return applied;
  }
  if (rng && applied > 0) checkConcentrationOnDamage(rng, target, applied);
  return applied;
}

/** Mark that a raging combatant attacked a hostile (hit or miss). */
export function markRageAttack(attacker: Combatant): void {
  if (attacker.raging) attacker.rageMaintained = true;
}

/**
 * Start-of-turn Rage clock: end if 1 minute elapsed or no attack/damage
 * since the prior turn start; otherwise clear the maintenance flag for
 * this turn's window. Call before bonus/action intents.
 */
export function tickRageAtTurnStart(actor: Combatant, round: number): void {
  if (!actor.raging) return;
  if (
    (actor.rageExpiresRound != null && round >= actor.rageExpiresRound) ||
    !actor.rageMaintained
  ) {
    endRage(actor);
    return;
  }
  actor.rageMaintained = false;
}

/**
 * Enter Rage: B/P/S resistance; costs one rage use.
 * Ends any concentration (can't concentrate while raging).
 * Heavy armor gate is unmodeled.
 * @param round current combat round (for 1-minute expiry ≈ round + 10)
 */
export function beginRage(actor: Combatant, round = 1): void {
  if (actor.raging || actor.ragesRemaining <= 0) return;
  actor.ragesRemaining -= 1;
  actor.raging = true;
  actor.rageMaintained = false;
  actor.rageExpiresRound = round + 10;
  endConcentration(actor);
  for (const type of RAGE_RESISTANCES) {
    if (!actor.resistances.some((t) => t.toLowerCase() === type)) {
      actor.resistances.push(type);
    }
  }
}

/** End Rage and strip the B/P/S resistances Rage added. */
export function endRage(actor: Combatant): void {
  if (!actor.raging) return;
  actor.raging = false;
  actor.rageMaintained = false;
  actor.rageExpiresRound = null;
  const drop = new Set<string>(RAGE_RESISTANCES);
  actor.resistances = actor.resistances.filter(
    (t) => !drop.has(t.toLowerCase()),
  );
}

export function applyHeal(target: Combatant, amount: number): void {
  if (!target.alive) return;
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

export function applyXp(target: Combatant, amount: number): void {
  if (!target.alive) return;
  target.xp += amount;
}
