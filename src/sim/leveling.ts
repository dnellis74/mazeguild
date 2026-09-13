import levelingData from "@/data/leveling.json";

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

/** Shared 5e XP thresholds (identical across classes). */
const XP_ROWS = TABLES.Fighter?.levels ?? [];

function parseXp(text: string): number {
  return Number.parseInt(text.replace(/,/g, ""), 10) || 0;
}

function parseLevel(label: string): number {
  const match = label.match(/^(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : 1;
}

/** Character level from total XP (class-agnostic). */
export function levelForXp(xp: number): number {
  if (XP_ROWS.length === 0) return 1;

  let level = 1;
  for (const row of XP_ROWS) {
    if (xp >= parseXp(row["XP Required"] ?? "0")) {
      level = parseLevel(row.Level ?? "1st");
    }
  }
  return level;
}

/**
 * Barbarian Rage uses at a given level (leveling.json "Rages" column).
 * Non-Barbarians / missing rows → 0. "Unlimited" → a large finite cap.
 */
export function ragesForLevel(level: number): number {
  const rows = TABLES.Barbarian?.levels ?? [];
  let rages = 0;
  for (const row of rows) {
    const rowLevel = parseLevel(row.Level ?? "1st");
    if (rowLevel > level) break;
    const text = (row.Rages ?? "0").trim();
    if (/^unlimited$/i.test(text)) {
      rages = 999;
    } else {
      rages = Number.parseInt(text, 10) || 0;
    }
  }
  return rages;
}

/**
 * Barbarian Rage Damage bonus at a given level (leveling.json "Rage Damage").
 * Returns the numeric bonus (e.g. 2 for "+2"). Non-Barbarians / missing → 0.
 */
export function rageDamageForLevel(level: number): number {
  const rows = TABLES.Barbarian?.levels ?? [];
  let bonus = 0;
  for (const row of rows) {
    const rowLevel = parseLevel(row.Level ?? "1st");
    if (rowLevel > level) break;
    const text = (row["Rage Damage"] ?? "0").trim();
    const n = Number.parseInt(text.replace(/^\+/, ""), 10);
    if (Number.isFinite(n)) bonus = n;
  }
  return bonus;
}
