import cantripData from "../../public/data/cantrips.json";
import type { Rng } from "./rng";
import type { DiceExpr } from "./types";

export type CantripCombatType = "attack" | "save" | "utility" | "stabilize";

export type CantripCastingTime = "action" | "bonus_action" | "reaction";

export type CantripDamage = DiceExpr & { type: string };

export type CantripEntry = {
  id: number;
  archetype: string;
  name: string;
  description: string;
  combatType: CantripCombatType;
  /**
   * Attack cantrips only: false = melee spell attack (e.g. Shocking Grasp),
   * true = ranged spell attack (e.g. Fire Bolt). Omitted on non-attack cantrips.
   */
  ranged?: boolean;
  /** Shocking Grasp: advantage on the attack roll vs metal armor. */
  advantageVsMetalArmor?: boolean;
  damage: CantripDamage | null;
  save: { ability: string; onSuccess: string } | null;
  castingTime?: CantripCastingTime;
};

const entries = (cantripData as { cantrips: CantripEntry[] }).cantrips;

/** First row per name wins — combat fields are identical across archetypes. */
const byName = new Map<string, CantripEntry>();
for (const row of entries) {
  if (!byName.has(row.name)) byName.set(row.name, row);
}

export function getCantrip(name: string): CantripEntry | undefined {
  return byName.get(name);
}

export function isAttackCantrip(name: string): boolean {
  const row = byName.get(name);
  return !!row && row.combatType === "attack" && !!row.damage;
}

export function isStabilizeCantrip(name: string): boolean {
  const row = byName.get(name);
  return !!row && row.combatType === "stabilize";
}

/**
 * Pick an attack-roll cantrip the character actually learned.
 * Multiple matches: sorted by name, then chosen with the seeded rng.
 * No learned attack cantrips → undefined (weapon only; never invent one).
 */
export function pickLearnedAttackCantrip(
  learned: { name: string }[] | null | undefined,
  rng?: Rng,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((c) => c.name).filter(Boolean)),
  ]
    .filter(isAttackCantrip)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (names.length === 0) return undefined;
  if (names.length === 1 || !rng) return names[0];
  return names[Math.floor(rng() * names.length)]!;
}

/** First learned stabilize cantrip (e.g. Spare the Dying), if any. */
export function pickLearnedStabilizeCantrip(
  learned: { name: string }[] | null | undefined,
): string | undefined {
  const names = [
    ...new Set((learned || []).map((c) => c.name).filter(Boolean)),
  ]
    .filter(isStabilizeCantrip)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return names[0];
}
