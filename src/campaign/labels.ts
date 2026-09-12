import type { Character } from "@/training/types";

/** Display label for a companion. */
export function characterLabel(character: Character): string {
  return (
    character.name?.trim() ||
    `${character.raceId || "Unknown"} companion`
  );
}
