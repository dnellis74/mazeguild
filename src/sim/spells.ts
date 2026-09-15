import spellDataL1 from "@/data/spells_level1.json";
import spellDataL2 from "@/data/spells_level2.json";
import type { ConditionName, DiceExpr } from "./types";

export type SpellCombatType =
  | "auto"
  | "attack"
  | "save"
  | "control"
  | "utility"
  | "reaction"
  | "buff"
  | "heal";

export type ReactionTrigger = "before_damage" | "after_damage";

export type SpellDamage = DiceExpr & {
  type: string;
  /** Separate damage instances (e.g. Magic Missile darts). Default 1. */
  per?: number;
  /** Flat bonus added to each instance after the dice (e.g. +1 per dart). */
  bonus?: number;
};

export type SpellEntry = {
  id: number;
  level: number;
  name: string;
  description: string;
  archetypes: string[];
  combatType?: SpellCombatType;
  /**
   * Attack spells only: false = melee spell attack (e.g. Inflict Wounds),
   * true = ranged spell attack (e.g. Guiding Bolt).
   */
  ranged?: boolean;
  damage?: SpellDamage | null;
  save?: { ability: string; onSuccess: string } | null;
  trigger?: ReactionTrigger;
  effect?: { acBonus?: number } | null;
  /** Control spell condition applied to covered targets. */
  condition?: ConditionName;
  /** HP pool dice for Sleep / Color Spray-style spells. */
  pool?: DiceExpr | null;
  /** How many combat rounds the condition lasts (1 minute ≈ 10). */
  durationRounds?: number;
  /** Creature types excluded from the pool (e.g. "undead"). */
  exclude?: string[];
  /** Color Spray: also skip creatures that can't see (already blinded). */
  ignoreCantSee?: boolean;
  /** Requires concentration while active (Bless). */
  concentration?: boolean;
  /** Condition applied to the target on a hit (Guiding Bolt → guided). */
  onHitCondition?: ConditionName;
  /** Rounds until onHitCondition expires (Guiding Bolt: end of caster's next turn ≈ 2). */
  conditionDurationRounds?: number;
  /** Heal spell dice (Cure Wounds / Healing Word). */
  healDice?: DiceExpr | null;
  /**
   * SRD casting time. Turn slots use action / bonus_action;
   * reaction is out-of-turn; minute/hour are longer (utility, not combat-cast).
   */
  castingTime?: CastingTime;
};

export type CastingTime =
  | "action"
  | "bonus_action"
  | "bonus action"
  | "reaction"
  | "minute"
  | "hour"
  | string;

const entries = [
  ...(spellDataL1 as { spells: SpellEntry[] }).spells,
  ...(spellDataL2 as { spells: SpellEntry[] }).spells,
];

const byName = new Map<string, SpellEntry>();
for (const row of entries) {
  if (!byName.has(row.name)) byName.set(row.name, row);
}

export function getSpell(name: string): SpellEntry | undefined {
  return byName.get(name);
}

/** Spells the combat layer can cast on its turn (auto-hit, slot cost). */
export function isCombatAutoSpell(name: string): boolean {
  const row = byName.get(name);
  return !!row && row.combatType === "auto" && !!row.damage;
}

/** HP-pool control spells (Sleep, Color Spray). */
export function isCombatControlSpell(name: string): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "control" &&
    !!row.pool &&
    !!row.condition &&
    (row.name === "Sleep" || row.name === "Color Spray")
  );
}

/** Concentration buffs (Bless). */
export function isCombatBuffSpell(name: string): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "buff" &&
    !!row.concentration &&
    row.name === "Bless"
  );
}

/** AoE save spells (Burning Hands, Thunderwave) — half damage on success. */
export function isCombatSaveSpell(name: string): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "save" &&
    !!row.damage &&
    row.save?.onSuccess === "half" &&
    (row.name === "Burning Hands" || row.name === "Thunderwave")
  );
}

/** Leveled spell attacks (Guiding Bolt, Inflict Wounds). */
export function isCombatAttackSpell(name: string): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "attack" &&
    !!row.damage &&
    (row.name === "Guiding Bolt" || row.name === "Inflict Wounds")
  );
}

/** Action-slot heal (Cure Wounds) — spends healSlots. */
export function isCombatActionHealSpell(name: string): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "heal" &&
    row.castingTime === "action" &&
    !!row.healDice &&
    row.name === "Cure Wounds"
  );
}

/** Bonus-action heal (Healing Word) — spends spellSlots. */
export function isCombatBonusHealSpell(name: string): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "heal" &&
    (row.castingTime === "bonus_action" || row.castingTime === "bonus action") &&
    !!row.healDice &&
    row.name === "Healing Word"
  );
}

export function isReactionSpell(
  name: string,
  trigger: ReactionTrigger,
): boolean {
  const row = byName.get(name);
  return (
    !!row &&
    row.combatType === "reaction" &&
    row.trigger === trigger &&
    !!row.effect
  );
}

/**
 * Pick a learned 1st-level auto spell the character actually knows.
 * This pass: only Magic Missile qualifies. Never invents an unlearned spell.
 */
export function pickLearnedAutoSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ]
    .filter(isCombatAutoSpell)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names[0];
}

/**
 * Pick a learned control spell (Sleep / Color Spray).
 * Prefers Sleep when both are known (longer-lasting control).
 * Never invents an unlearned spell.
 */
export function pickLearnedControlSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ].filter(isCombatControlSpell);
  if (names.includes("Sleep")) return "Sleep";
  names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names[0];
}

/**
 * Pick a learned leveled spell attack. Prefers Guiding Bolt (advantage setup).
 * Never invents an unlearned spell.
 */
export function pickLearnedAttackSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ].filter(isCombatAttackSpell);
  if (names.includes("Guiding Bolt")) return "Guiding Bolt";
  if (names.includes("Inflict Wounds")) return "Inflict Wounds";
  return undefined;
}

/**
 * Pick a learned action-slot heal (Cure Wounds only).
 * Never invents an unlearned spell; Healing Word is bonus-action only.
 */
export function pickLearnedHealSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ].filter(isCombatActionHealSpell);
  if (names.includes("Cure Wounds")) return "Cure Wounds";
  return undefined;
}

/**
 * Pick a learned bonus-action heal (Healing Word only).
 * Never invents an unlearned spell.
 */
export function pickLearnedBonusHealSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ].filter(isCombatBonusHealSpell);
  if (names.includes("Healing Word")) return "Healing Word";
  return undefined;
}

/**
 * Pick a learned AoE save spell (Burning Hands / Thunderwave).
 * Prefers Burning Hands (higher expected damage: 10.5 vs 9).
 * Never invents an unlearned spell.
 */
export function pickLearnedSaveSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ].filter(isCombatSaveSpell);
  if (names.includes("Burning Hands")) return "Burning Hands";
  if (names.includes("Thunderwave")) return "Thunderwave";
  return undefined;
}

/**
 * Pick a learned buff spell (Bless). Never invents an unlearned spell.
 */
export function pickLearnedBuffSpell(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ]
    .filter(isCombatBuffSpell)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names[0];
}

/**
 * Pick a learned reaction spell for before_damage (this pass: Shield only).
 * Never invents an unlearned spell.
 */
export function pickLearnedReactionSpell(
  learned: { name: string }[] | null | undefined,
  trigger: ReactionTrigger = "before_damage",
): string | undefined {
  const names = [
    ...new Set((learned || []).map((s) => s.name).filter(Boolean)),
  ]
    .filter((n) => isReactionSpell(n, trigger))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names[0];
}
