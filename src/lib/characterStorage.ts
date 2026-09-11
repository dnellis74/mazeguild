import type { Character } from "@/training/types";

/**
 * Browser persistence bridge between character creation (static HTML) and
 * training/quest (React). Creation writes this key on finish; TrainingClient
 * reads/writes it for the rest of the loop.
 *
 * Keep the string in sync with `STORAGE_KEY` in
 * `public/character-initialization.html`.
 */
export const CHARACTER_STORAGE_KEY = "mazeguild.character";

export function loadCharacter(): Character | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Character;
  } catch {
    return null;
  }
}

export function saveCharacter(character: Character): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(character));
}

export function clearCharacter(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHARACTER_STORAGE_KEY);
}
