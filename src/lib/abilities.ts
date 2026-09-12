/** Shared ability ids — used by training and the maze sim. */

export type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export const ABILITY_ORDER: Ability[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export const ABILITY_FULL_NAME: Record<Ability, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

export const ABILITY_SHORT_NAME: Record<string, Ability> = Object.fromEntries(
  Object.entries(ABILITY_FULL_NAME).map(([short, full]) => [full, short as Ability]),
) as Record<string, Ability>;
