/** Armor shape used by combat AC (resolved from equipment.json). */

export type ArmorCategory = "light" | "medium" | "heavy";

export type ArmorDef = {
  name: string;
  category: ArmorCategory;
  baseAC: number;
  /** null = full DEX; 2 = medium cap; 0 = heavy (no DEX). */
  dexCap: number | null;
  strRequirement: number | null;
  /** Catalog materials, e.g. `["metal"]`. */
  material?: string[];
};
