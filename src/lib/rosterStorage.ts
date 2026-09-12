import type { Character } from "@/training/types";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";

/**
 * Multi-character roster for Town Square.
 * Legacy single-character key `mazeguild.character` is migrated once on load.
 * Legacy nested `{ id, displayName, character }` and `displayName` fields flatten to `name`.
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

function flattenEntry(raw: unknown): Character | null {
  if (!isPlainObject(raw)) return null;

  // Legacy nested roster shape
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
    const character = JSON.parse(legacy) as Character & { displayName?: string };
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
        roster.map((e) => e.name),
      );
      const name = pickName(character.name, character.displayName) || named.name;
      roster.push({
        ...character,
        id: character.id || crypto.randomUUID(),
        name,
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

/** Copy maze XP / HP onto roster companions (matched by id). */
export function applyQuestAftermath(
  updates: Array<{ id: string; xp: number; hp: number }>,
): void {
  if (updates.length === 0) return;
  const roster = loadRoster();
  let changed = false;
  for (const u of updates) {
    const idx = roster.findIndex((e) => e.id === u.id);
    if (idx < 0) continue;
    roster[idx] = {
      ...roster[idx]!,
      xp: u.xp,
      hp: u.hp,
    };
    changed = true;
  }
  if (changed) writeRaw(roster);
}

/** @deprecated Use roster helpers. Kept for a few call sites during migration. */
export const CHARACTER_STORAGE_KEY = LEGACY_CHARACTER_KEY;
