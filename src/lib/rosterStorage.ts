import type { Character } from "@/training/types";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";

/**
 * Multi-character roster for Town Square.
 * Legacy single-character key `mazeguild.character` is migrated once on load.
 *
 * Creation HTML appends via the same ROSTER_KEY string — keep in sync with
 * `public/character-initialization.html`.
 */
export const ROSTER_KEY = "mazeguild.roster";
export const LEGACY_CHARACTER_KEY = "mazeguild.character";

export type RosterEntry = {
  id: string;
  displayName: string;
  character: Character;
};

function readRaw(): RosterEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RosterEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as RosterEntry).id === "string" &&
        typeof (e as RosterEntry).displayName === "string" &&
        !!(e as RosterEntry).character,
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: RosterEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROSTER_KEY, JSON.stringify(entries));
}

/** Import legacy single-character save into the roster if present. */
export function migrateLegacyCharacter(): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = localStorage.getItem(LEGACY_CHARACTER_KEY);
    if (!legacy) return;
    const character = JSON.parse(legacy) as Character;
    const roster = readRaw();
    const already = roster.some(
      (e) => JSON.stringify(e.character) === JSON.stringify(character),
    );
    if (!already) {
      const named = generateUniqueFantasyName(
        character.raceId,
        roster.map((e) => e.displayName),
      );
      roster.push({
        id: crypto.randomUUID(),
        displayName: named.name,
        character,
      });
      writeRaw(roster);
    }
    localStorage.removeItem(LEGACY_CHARACTER_KEY);
  } catch {
    // leave legacy key alone if corrupt
  }
}

export function loadRoster(): RosterEntry[] {
  migrateLegacyCharacter();
  return readRaw();
}

export function saveRoster(entries: RosterEntry[]): void {
  writeRaw(entries);
}

export function getRosterEntry(id: string): RosterEntry | null {
  return loadRoster().find((e) => e.id === id) ?? null;
}

export function upsertRosterEntry(entry: RosterEntry): void {
  const roster = loadRoster();
  const idx = roster.findIndex((e) => e.id === entry.id);
  if (idx >= 0) roster[idx] = entry;
  else roster.push(entry);
  writeRaw(roster);
}

export function removeRosterEntry(id: string): void {
  writeRaw(loadRoster().filter((e) => e.id !== id));
}

/** @deprecated Use roster helpers. Kept for a few call sites during migration. */
export const CHARACTER_STORAGE_KEY = LEGACY_CHARACTER_KEY;
