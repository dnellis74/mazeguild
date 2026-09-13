import armorData from "@/data/armor.json";
import type { Ability } from "@/lib/abilities";
import { abilityMod } from "./rules";

export type ArmorCategory = "light" | "medium" | "heavy";

export type ArmorDef = {
  name: string;
  category: ArmorCategory;
  baseAC: number;
  /** null = full DEX; 2 = medium cap; 0 = heavy (no DEX). */
  dexCap: number | null;
  strRequirement: number | null;
};

export type ArmorLoadout = {
  armor: ArmorDef | null;
  shield: boolean;
};

type ArmorFallbackEntry = {
  armor: string | null;
  shield?: boolean;
};

type ArmorFile = {
  armor: Record<string, ArmorDef>;
  shield: { name: string; acBonus: number };
  armor_fallback: Record<string, ArmorFallbackEntry>;
};

const DATA = armorData as unknown as ArmorFile;

export function getArmor(key: string): ArmorDef {
  const def = DATA.armor[key];
  if (!def) throw new Error(`Unknown armor: ${key}`);
  return def;
}

/** Apply base AC + DEX per category rules; shield stacks on top. */
export function computeAcFromArmor(
  scores: Record<Ability, number>,
  loadout: ArmorLoadout,
): number {
  const dex = abilityMod(scores.DEX ?? 10);
  let ac: number;
  if (!loadout.armor) {
    ac = 10 + dex;
  } else {
    const { baseAC, dexCap } = loadout.armor;
    if (dexCap === 0) {
      ac = baseAC;
    } else if (dexCap === null) {
      ac = baseAC + dex;
    } else {
      ac = baseAC + Math.min(dex, dexCap);
    }
  }
  if (loadout.shield) ac += DATA.shield.acBonus;
  return ac;
}
