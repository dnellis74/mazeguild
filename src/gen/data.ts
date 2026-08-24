import type { Ability } from "@/sim/types";
import tables from "./tables.json";

export type AbilityBonusChoice = {
  count: number;
  amount: number;
  exclude: string[];
};

export type SkillChoice = {
  count: number;
  pool: string[] | null;
};

export type SubraceData = {
  ability_bonus?: Record<string, number>;
  hp_bonus_per_level?: number;
  traits?: string[];
  weapon_proficiencies?: string[];
  tool_proficiencies?: string[];
  extra_language?: boolean;
};

export type RaceData = {
  ability_bonus: Partial<Record<Ability, number>>;
  ability_bonus_choice?: AbilityBonusChoice;
  size: string;
  speed: number;
  languages: string[];
  extra_language?: boolean;
  skill_bonus?: string[];
  skill_choice?: SkillChoice;
  weapon_proficiencies?: string[];
  tool_proficiency_choice?: string[];
  traits: string[];
  subraces: Record<string, SubraceData>;
};

export type ToolChoice = {
  choose: number;
  pool: string[];
  label: string;
};

export type EquipmentOption = { fixed: string[] } | { choose: string[] };

export type SpellSpec = {
  ability: Ability;
  type: "known" | "prepared" | "spellbook";
  cantrips_known: number;
  spells_known?: number;
  spellbook_size?: number;
  slots: Record<string, number>;
  pact_magic?: boolean;
};

export type ClassData = {
  hit_die: number;
  saving_throws: Ability[];
  armor_proficiencies: string[];
  weapon_proficiencies: string[];
  tool_proficiencies: string[] | ToolChoice;
  skill_choice: { count: number; pool: string[] };
  equipment_options: EquipmentOption[];
  level1_features: string[];
  ability_priority: Ability[];
  unarmored_defense: "barbarian" | "monk" | null;
  spellcasting: SpellSpec | null;
};

export type ItemStats = {
  category?: string;
  cost: string;
  base_ac?: number;
  str_req?: number | null;
  stealth_dis?: boolean;
  weight?: number;
  damage?: string;
  properties?: string[];
  contents?: string[];
};

export const ABILITIES = tables.ABILITIES as Ability[];
export const ALIGNMENTS = tables.ALIGNMENTS;
export const ALL_CHOOSABLE_LANGUAGES = tables.ALL_CHOOSABLE_LANGUAGES;
export const ALL_SKILLS = tables.ALL_SKILLS;
export const DRACONIC_ANCESTRY = tables.DRACONIC_ANCESTRY as Record<
  string,
  { damage_type: string; breath_weapon: string }
>;
export const RACES = tables.RACES as Record<string, RaceData>;
export const CLASSES = tables.CLASSES as Record<string, ClassData>;
export const BACKGROUND_ACOLYTE = tables.BACKGROUND_ACOLYTE;
export const ARMOR = tables.ARMOR as Record<string, ItemStats>;
export const SHIELD_AC_BONUS = tables.SHIELD_AC_BONUS;
export const WEAPONS = tables.WEAPONS as Record<string, ItemStats>;
export const EQUIPMENT_PACKS = tables.EQUIPMENT_PACKS as Record<
  string,
  ItemStats
>;
export const SPELLS = tables.SPELLS as Record<
  string,
  { cantrips: string[]; level1: string[] }
>;
export const STANDARD_ARRAY = tables.STANDARD_ARRAY;

export const RACE_NAMES = Object.keys(RACES);
export const CLASS_NAMES = Object.keys(CLASSES);

export const TANK_CLASSES = ["Barbarian", "Fighter", "Paladin"] as const;
export const HEALER_CLASSES = ["Cleric", "Druid", "Bard"] as const;

export const PARTY_CAP = 4;
/** How many adventurers sit in the tavern for the player to pick from. */
export const TAVERN_CAP = 12;
