import type { Character } from "@/training/types";
import type { Catalog } from "./catalog";
import { baseAbilityScores } from "./abilities";
import { normalizeEarnedFeatures } from "./features";
import type { Ability } from "./types";
import { ABILITY_ORDER } from "./types";
import { ensureUnlocked } from "./world";

/**
 * Normalize a companion from storage / API.
 * Intake uses createEmptyCompanion; this validates identity and fills training defaults.
 */
export function migrateCharacter(catalog: Catalog, raw: unknown): Character {
  const ch = (raw || {}) as Partial<Character> & Record<string, unknown>;

  if (typeof ch.id !== "string" || !ch.id) {
    throw new Error("Companion is missing id");
  }
  if (typeof ch.name !== "string" || !ch.name.trim()) {
    throw new Error("Companion is missing name");
  }

  const alignmentRaw = (ch.alignment || {}) as Character["alignment"] &
    Record<string, unknown>;

  let next: Character = {
    id: ch.id,
    name: ch.name.trim(),
    raceId: String(ch.raceId || ""),
    subrace: (ch.subrace as Character["subrace"]) || null,
    alignment: {
      alignmentId: String(alignmentRaw.alignmentId || ""),
      definingExperience: alignmentRaw.definingExperience ?? null,
    },
    featurePoints: ch.featurePoints == null ? 2 : Number(ch.featurePoints),
    features: Array.isArray(ch.features) ? (ch.features as Character["features"]) : [],
    cantrips: Array.isArray(ch.cantrips) ? (ch.cantrips as Character["cantrips"]) : [],
    spells: Array.isArray(ch.spells) ? (ch.spells as Character["spells"]) : [],
    abilityScores: (ch.abilityScores as Record<Ability, number>) || baseAbilityScores(catalog),
    abilityScoresAssigned: Boolean(ch.abilityScoresAssigned),
    abilityPointsUnspent: ch.abilityPointsUnspent as number | undefined,
    originStory: (ch.originStory as string | null | undefined) ?? null,
    unlocked: (ch.unlocked as Character["unlocked"]) || {
      areas: {},
      buildings: {},
      rooms: {},
    },
    activeJob: (ch.activeJob as Character["activeJob"]) ?? null,
    xp: typeof ch.xp === "number" && Number.isFinite(ch.xp) ? ch.xp : 0,
    hp:
      typeof ch.hp === "number" && Number.isFinite(ch.hp)
        ? Math.max(0, Math.floor(ch.hp))
        : ch.hp === null
          ? null
          : undefined,
  };

  if (!next.abilityScoresAssigned || !next.abilityScores) {
    next.abilityScores = baseAbilityScores(catalog);
  }

  for (const ab of ABILITY_ORDER) {
    if (next.abilityScores[ab] == null) {
      next.abilityScores[ab] = catalog.abilityMods?.pointBuy?.startingScore ?? 8;
    }
  }

  // Drop corrupt activity jobs that lack a skill id (legacy).
  if (next.activeJob?.kind === "activity" && !next.activeJob.skillId) {
    next.activeJob = null;
  }

  next = ensureUnlocked(next);
  next = normalizeEarnedFeatures(catalog, next);
  return next;
}

export function defaultTrainingUi(): import("./types").TrainingUi {
  return {
    hubTab: "world",
    worldView: "areas",
    worldArea: null,
    worldBuilding: null,
    worldRoom: null,
    pendingChoice: null,
    originDraft: null,
  };
}

export function validateCharacter(ch: Character): string | null {
  if (!ch.id) return "Missing id";
  if (!ch.name?.trim()) return "Missing name";
  if (!ch.raceId) return "Missing race";
  if (!ch.alignment?.alignmentId) return "Missing alignment";
  return null;
}
