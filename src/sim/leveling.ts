import levelingData from "@/data/leveling.json";
import { CLASSES } from "@/gen/data";
import { d, type Rng } from "./rng";
import { abilityMod } from "./rules";
import type { Ability, SrdCharacter } from "./types";

export type LevelRow = Record<string, string>;

export type HitDiceInfo = {
  die: string;
  hp_at_1st_level: string;
  hp_at_higher_levels: string;
};

export type ClassProgression = {
  hit_dice: HitDiceInfo;
  levels: LevelRow[];
};

type LevelingTable = Record<string, ClassProgression>;

const TABLES = levelingData as LevelingTable;

const ABILITIES: Ability[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const SLOT_LABELS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
] as const;

const SLOT_KEYS: Record<(typeof SLOT_LABELS)[number], string> = {
  "1st": "1",
  "2nd": "2",
  "3rd": "3",
  "4th": "4",
  "5th": "5",
  "6th": "6",
  "7th": "7",
  "8th": "8",
  "9th": "9",
};

function parseXp(text: string): number {
  return Number.parseInt(text.replace(/,/g, ""), 10) || 0;
}

function parseLevel(label: string): number {
  const match = label.match(/^(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : 1;
}

function profBonus(row: LevelRow): string {
  return row["Proficiency Bonus"] ?? row["Prof. Bonus"] ?? "+2";
}

function parseProfBonus(text: string): number {
  return Number.parseInt(text.replace("+", ""), 10) || 2;
}

function fmtMod(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function hasDwarvenToughness(character: SrdCharacter): boolean {
  return (character.racial_traits ?? []).some((trait) =>
    /Dwarven Toughness/i.test(trait),
  );
}

export function hitDieSides(className: string): number {
  const die = TABLES[className]?.hit_dice.die;
  const match = die?.match(/(\d+)/);
  if (match) return Number.parseInt(match[1]!, 10);
  return CLASSES[className]?.hit_die ?? 8;
}

function classLevels(className: string): LevelRow[] {
  return TABLES[className]?.levels ?? [];
}

function hpGainFromRoll(
  roll: number,
  conMod: number,
  dwarvenToughness: boolean,
): number {
  return Math.max(1, roll + conMod) + (dwarvenToughness ? 1 : 0);
}

export function levelForXp(className: string, xp: number): number {
  const rows = classLevels(className);
  if (rows.length === 0) return 1;

  let level = 1;
  for (const row of rows) {
    if (xp >= parseXp(row["XP Required"] ?? "0")) {
      level = parseLevel(row.Level ?? "1st");
    }
  }
  return level;
}

function featuresThroughLevel(className: string, level: number): string[] {
  const rows = classLevels(className);
  const features: string[] = [];
  for (let i = 0; i < Math.min(level, rows.length); i++) {
    const feature = rows[i]?.Features;
    if (feature && feature !== "-") features.push(feature);
  }
  return features;
}

function parseSpellSlots(
  row: LevelRow,
  className: string,
): Record<string, number> {
  if (className === "Warlock") {
    const count = Number.parseInt(row["Spell Slots"] ?? "0", 10);
    return count > 0 ? { "1": count } : {};
  }

  const slots: Record<string, number> = {};
  for (const label of SLOT_LABELS) {
    const value = row[label];
    if (!value || value === "-") continue;
    slots[SLOT_KEYS[label]] = Number.parseInt(value, 10);
  }
  return slots;
}

function updateSavingThrows(
  character: SrdCharacter,
  prof: number,
): Record<string, string> {
  const proficient = CLASSES[character.class]?.saving_throws ?? [];
  const savingThrows: Record<string, string> = {};
  for (const ability of ABILITIES) {
    const mod = abilityMod(character.ability_scores[ability]?.score ?? 10);
    const total = mod + (proficient.includes(ability) ? prof : 0);
    savingThrows[ability] = fmtMod(total);
  }
  return savingThrows;
}

function updateSpellcasting(
  character: SrdCharacter,
  row: LevelRow,
  prof: number,
): SrdCharacter["spellcasting"] {
  const spellcasting = character.spellcasting;
  if (!spellcasting) return null;

  const ability = (spellcasting.ability as Ability | undefined) ?? "WIS";
  const mod = abilityMod(character.ability_scores[ability]?.score ?? 10);
  const next: NonNullable<SrdCharacter["spellcasting"]> = {
    ...spellcasting,
    spell_save_dc: 8 + prof + mod,
    spell_attack_bonus: fmtMod(prof + mod),
  };

  const slots = parseSpellSlots(row, character.class);
  if (Object.keys(slots).length > 0) {
    next.spell_slots = slots;
  }

  const cantrips = row["Cantrips Known"];
  if (cantrips && cantrips !== "-") {
    next.cantrips_known = (next.cantrips_known ?? []).slice(
      0,
      Number.parseInt(cantrips, 10),
    );
  }

  const spellsKnown = row["Spells Known"];
  if (spellsKnown && spellsKnown !== "-") {
    next.spells_known = (next.spells_known ?? []).slice(
      0,
      Number.parseInt(spellsKnown, 10),
    );
  }

  return next;
}

/** Apply XP, roll hit dice for new levels, and restore HP to the new maximum. */
export function applyProgression(
  character: SrdCharacter,
  xp: number,
  rng: Rng,
): SrdCharacter {
  const className = character.class;
  const rows = classLevels(className);
  const fromLevel = character.meta?.level ?? 1;
  const toLevel = levelForXp(className, xp);
  const row = rows[toLevel - 1];
  const prof = row ? parseProfBonus(profBonus(row)) : 2;
  const sides = hitDieSides(className);
  const conMod = abilityMod(character.ability_scores.CON?.score ?? 10);
  const dwarf = hasDwarvenToughness(character);
  const rolls = [...(character.hit_point_rolls ?? [])];
  let hp = character.hit_points.value;

  for (let level = fromLevel + 1; level <= toLevel; level++) {
    const roll = d(rng, sides);
    rolls.push(roll);
    hp += hpGainFromRoll(roll, conMod, dwarf);
  }

  const next: SrdCharacter = {
    ...character,
    xp,
    meta: {
      ...character.meta,
      level: toLevel,
    },
    proficiency_bonus: row ? profBonus(row) : character.proficiency_bonus,
    hit_points: {
      ...character.hit_points,
      value: hp,
      hit_die: `${toLevel}d${sides}`,
    },
    hit_point_rolls: rolls,
    class_features: featuresThroughLevel(className, toLevel),
    saving_throws: updateSavingThrows(character, prof),
  };

  if (row) {
    next.spellcasting = updateSpellcasting(character, row, prof);
  }

  return next;
}
