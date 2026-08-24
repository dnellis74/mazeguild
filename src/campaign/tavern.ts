import { applyProgression } from "@/sim/leveling";
import { createRng } from "@/sim/rng";
import type { PartySnapshot, SrdCharacter } from "@/sim/types";

export function characterLabel(character: SrdCharacter): string {
  return character.name?.trim() || `${character.race} ${character.class}`;
}

export function sortPatrons(patrons: SrdCharacter[]): SrdCharacter[] {
  return [...patrons].sort((a, b) =>
    characterLabel(a).localeCompare(characterLabel(b)),
  );
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Merge a finished maze run back into the tavern roster. */
export function applyTavernReturn(
  patrons: SrdCharacter[],
  runParty: string[],
  party: PartySnapshot[],
  wiped: boolean,
  seed: number,
): SrdCharacter[] {
  if (wiped) return sortPatrons(patrons);

  const runSet = new Set(runParty);
  const xpByName = new Map(party.map((member) => [member.name, member.xp]));

  return sortPatrons(
    patrons.map((character) => {
      const label = characterLabel(character);
      if (!runSet.has(label)) return character;
      const runXp = xpByName.get(label) ?? character.xp ?? 0;
      const rng = createRng(hashSeed(`${seed}:${label}:hp`));
      return applyProgression(character, runXp, rng);
    }),
  );
}
