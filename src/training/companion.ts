import { emptyEquipment } from "@/sim/loadout";
import type { Catalog } from "./catalog";
import { alignmentById, raceById } from "./catalog";
import { baseAbilityScores } from "./abilities";
import type { Character } from "./types";
import { ensureUnlocked } from "./world";

export type EmptyCompanionInput = {
  id: string;
  name: string;
  raceId: string;
  subrace?: Character["subrace"];
  alignment: {
    alignmentId: string;
    definingExperience?: Character["alignment"]["definingExperience"];
  };
};

/**
 * Fresh companion after creation — single factory for intake, tests, and APIs.
 * Defaults match what training expects before features / point-buy.
 */
export function createEmptyCompanion(
  catalog: Catalog,
  input: EmptyCompanionInput,
): Character {
  const scores = baseAbilityScores(catalog);
  const companion: Character = {
    id: input.id,
    name: input.name.trim(),
    raceId: input.raceId,
    subrace: input.subrace ?? null,
    alignment: {
      alignmentId: input.alignment.alignmentId,
      definingExperience: input.alignment.definingExperience ?? null,
    },
    featurePoints: 2,
    features: [],
    cantrips: [],
    spells: [],
    abilityScores: scores,
    abilityScoresAssigned: false,
    originStory: null,
    unlocked: { areas: {}, buildings: {}, rooms: {} },
    activeJob: null,
    xp: 0,
    hp: null,
    hitDiceTotal: 1,
    hitDiceRemaining: 1,
    equipment: emptyEquipment(),
  };
  return ensureUnlocked(companion);
}

/** Display label for a companion. */
export function characterLabel(character: Character): string {
  return (
    character.name?.trim() ||
    `${character.raceId || "Unknown"} companion`
  );
}

/** Catalog race display name (falls back to title-cased id). */
export function raceDisplayName(catalog: Catalog, raceId: string): string {
  const race = raceById(catalog, raceId);
  if (race?.name) return race.name;
  return titleCaseId(raceId);
}

/** Catalog alignment display name. */
export function alignmentDisplayName(
  catalog: Catalog,
  alignmentId: string,
): string {
  return alignmentById(catalog, alignmentId)?.name || alignmentId.toUpperCase() || "?";
}

export function titleCaseId(id: string): string {
  if (!id) return "Unknown";
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
