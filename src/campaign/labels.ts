import type { SrdCharacter } from "@/sim/types";

/** Display label for an SRD party member (unique-ish by name). */
export function characterLabel(character: SrdCharacter): string {
  return character.name?.trim() || `${character.race} ${character.class}`;
}
