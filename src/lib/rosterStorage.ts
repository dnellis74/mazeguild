import type { Character } from "@/training/types";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";
import {
  restoreAfterTownReturn,
  type TownReturnLevelUp,
} from "@/training/townRest";

export type RosterLevelUp = TownReturnLevelUp & {
  id: string;
  name: string;
};

/**
 * Multi-character roster for Town Square (`Character[]` in localStorage).
 * Legacy nested / displayName / single-character keys migrate once when needed.
 */
export const ROSTER_KEY = "mazeguild.roster";
const LEGACY_CHARACTER_KEY = "mazeguild.character";
const ROSTER_FLAT_FLAG = "mazeguild.roster.flat";

type LegacyNested = {
  id?: string;
  name?: string;
  displayName?: string;
  character?: Partial<Character> & Record<string, unknown>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickName(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

function isLegacyShape(raw: unknown): boolean {
  if (!isPlainObject(raw)) return true;
  if (isPlainObject(raw.character) && !(typeof raw.raceId === "string" && raw.raceId)) {
    return true;
  }
  if (typeof raw.displayName === "string") return true;
  if (typeof raw.id !== "string" || !raw.id) return true;
  if (typeof raw.name !== "string" || !raw.name.trim()) return true;
  return false;
}

function flattenEntry(raw: unknown): Character | null {
  if (!isPlainObject(raw)) return null;

  if (isPlainObject(raw.character) && !(typeof raw.raceId === "string" && raw.raceId)) {
    const nested = raw as LegacyNested;
    const inner = nested.character!;
    const id =
      (typeof nested.id === "string" && nested.id) ||
      (typeof inner.id === "string" && inner.id) ||
      "";
    const name = pickName(
      nested.name,
      nested.displayName,
      inner.name,
      inner.displayName,
    );
    if (!id || !inner.raceId) return null;
    const { displayName: _drop, ...rest } = inner as Character & {
      displayName?: string;
    };
    return {
      ...rest,
      id,
      name: name || "Companion",
    };
  }

  if (typeof raw.raceId !== "string" || !raw.raceId) return null;
  const id =
    typeof raw.id === "string" && raw.id
      ? raw.id
      : typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}`;
  const name = pickName(raw.name, raw.displayName) || "Companion";
  const { displayName: _drop, ...rest } = raw as Character & {
    displayName?: string;
  };
  return { ...rest, id, name };
}

function readRaw(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: Character[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROSTER_KEY, JSON.stringify(entries));
  localStorage.setItem(ROSTER_FLAT_FLAG, "1");
}

function migrateLegacyCharacter(roster: Character[]): Character[] {
  if (typeof window === "undefined") return roster;
  try {
    const legacy = localStorage.getItem(LEGACY_CHARACTER_KEY);
    if (!legacy) return roster;
    const character = JSON.parse(legacy) as Character & { displayName?: string };
    const already = roster.some(
      (e) =>
        e.raceId === character.raceId &&
        e.alignment?.alignmentId === character.alignment?.alignmentId &&
        JSON.stringify(e.features) === JSON.stringify(character.features || []),
    );
    if (!already) {
      const named = generateUniqueFantasyName(
        character.raceId,
        roster.map((e) => e.name),
      );
      const name = pickName(character.name, character.displayName) || named.name;
      roster = [
        ...roster,
        {
          ...character,
          id: character.id || crypto.randomUUID(),
          name,
        },
      ];
    }
    localStorage.removeItem(LEGACY_CHARACTER_KEY);
  } catch {
    // leave legacy key alone if corrupt
  }
  return roster;
}

export function loadRoster(): Character[] {
  if (typeof window === "undefined") return [];
  const raw = readRaw();
  const needsFlatten =
    localStorage.getItem(ROSTER_FLAT_FLAG) !== "1" ||
    raw.some(isLegacyShape);
  let roster = raw.map(flattenEntry).filter((e): e is Character => !!e);
  const beforeLegacy = roster.length;
  roster = migrateLegacyCharacter(roster);
  if (needsFlatten || roster.length !== beforeLegacy) {
    writeRaw(roster);
  }
  return roster;
}

export function saveRoster(entries: Character[]): void {
  writeRaw(entries);
}

export function getRosterEntry(id: string): Character | null {
  return loadRoster().find((e) => e.id === id) ?? null;
}

export function upsertRosterEntry(entry: Character): void {
  const roster = loadRoster();
  const idx = roster.findIndex((e) => e.id === entry.id);
  if (idx >= 0) roster[idx] = entry;
  else roster.push(entry);
  writeRaw(roster);
}

export function removeRosterEntry(id: string): void {
  writeRaw(loadRoster().filter((e) => e.id !== id));
}

/**
 * Apply maze XP and full town recovery to roster companions (matched by id).
 * HP / Hit Dice / rest resources are restored unconditionally — maze HP is
 * not persisted (see restoreAfterTownReturn). Level-ups grant Hit Dice and
 * feature points.
 */
export function applyQuestAftermath(
  updates: Array<{ id: string; xp: number }>,
): RosterLevelUp[] {
  if (updates.length === 0) return [];
  const roster = loadRoster();
  const levelUps: RosterLevelUp[] = [];
  let changed = false;
  for (const u of updates) {
    const idx = roster.findIndex((e) => e.id === u.id);
    if (idx < 0) continue;
    const { character, levelUp } = restoreAfterTownReturn(roster[idx]!, u.xp);
    roster[idx] = character;
    if (levelUp) {
      levelUps.push({
        ...levelUp,
        id: character.id,
        name: character.name,
      });
    }
    changed = true;
  }
  if (changed) writeRaw(roster);
  return levelUps;
}
