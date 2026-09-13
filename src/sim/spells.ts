import spellData from "../../public/data/spells_level1.json";
import type { DiceExpr } from "./types";

export type SpellCombatType =
  | "auto"
  | "attack"
  | "save"
  | "control"
  | "utility";

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
  damage?: SpellDamage | null;
  save?: { ability: string; onSuccess: string } | null;
};

const entries = (spellData as { spells: SpellEntry[] }).spells;

const byName = new Map<string, SpellEntry>();
for (const row of entries) {
  if (!byName.has(row.name)) byName.set(row.name, row);
}

export function getSpell(name: string): SpellEntry | undefined {
  return byName.get(name);
}

/** Spells the combat layer can cast this pass (auto-hit, slot cost). */
export function isCombatAutoSpell(name: string): boolean {
  const row = byName.get(name);
  return !!row && row.combatType === "auto" && !!row.damage;
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
