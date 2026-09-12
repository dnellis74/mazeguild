import type { Character } from "@/training/types";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";

/**
 * Multi-character roster for Town Square.
 * Legacy single-character key `mazeguild.character` is migrated once on load.
 * Legacy nested `{ id, displayName, character }` entries are flattened.
 *
 * Creation HTML appends via the same ROSTER_KEY string — keep in sync with
 * `public/character-initialization.html`.
 */
export const ROSTER_KEY = "mazeguild.roster";
export const LEGACY_CHARACTER_KEY = "mazeguild.character";

/** Roster row is the shared companion character. */
export type RosterEntry = Character;

type LegacyNested = {
  id?: string;
  displayName?: string;
  character?: Partial<Character> & Record<string, unknown>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function flattenEntry(raw: unknown): Character | null {
  if (!isPlainObject(raw)) return null;

  // Legacy nested roster shape
  if (isPlainObject(raw.character) && !("raceId" in raw && raw.raceId)) {
    const nested = raw as LegacyNested;
    const inner = nested.character!;
    const id =
      (typeof nested.id === "string" && nested.id) ||
      (typeof inner.id === "string" && inner.id) ||
      "";
    const displayName =
      (typeof nested.displayName === "string" && nested.displayName) ||
      (typeof inner.displayName === "string" && inner.displayName) ||
      "Companion";
    if (!id || !inner.raceId) return null;
    return {
      ...(inner as Character),
      id,
      displayName,
    };
  }

  if (typeof raw.raceId !== "string" || !raw.raceId) return null;
  const id =
    typeof raw.id === "string" && raw.id
      ? raw.id
      : typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}`;
  const displayName =
    typeof raw.displayName === "string" && raw.displayName.trim()
      ? raw.displayName
      : "Companion";
  return { ...(raw as Character), id, displayName };
}

function readRaw(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(flattenEntry).filter((e): e is Character => !!e);
  } catch {
    return [];
  }
}

function writeRaw(entries: Character[]) {
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
      (e) =>
        e.raceId === character.raceId &&
        e.alignment?.alignmentId === character.alignment?.alignmentId &&
        JSON.stringify(e.features) === JSON.stringify(character.features || []),
    );
    if (!already) {
      const named = generateUniqueFantasyName(
        character.raceId,
        roster.map((e) => e.displayName),
      );
      roster.push({
        ...character,
        id: character.id || crypto.randomUUID(),
        displayName: character.displayName || named.name,
      });
      writeRaw(roster);
    }
    localStorage.removeItem(LEGACY_CHARACTER_KEY);
  } catch {
    // leave legacy key alone if corrupt
  }
}

export function loadRoster(): Character[] {
  migrateLegacyCharacter();
  const roster = readRaw();
  // Rewrite flattened shape so nested legacy does not linger
  writeRaw(roster);
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

/** @deprecated Use roster helpers. Kept for a few call sites during migration. */
export const CHARACTER_STORAGE_KEY = LEGACY_CHARACTER_KEY;
