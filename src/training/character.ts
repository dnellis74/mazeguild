import type { Character } from "@/training/types";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";
import type { Catalog } from "./catalog";
import { baseAbilityScores } from "./abilities";
import { normalizeEarnedFeatures } from "./features";
import type { Ability } from "./types";
import { ABILITY_ORDER } from "./types";
import { featureLabel } from "./features";
import { ensureUnlocked } from "./world";

export function migrateCharacter(catalog: Catalog, raw: unknown): Character {
  const ch = (raw || {}) as Partial<Character> & Record<string, unknown>;
  const id =
    typeof ch.id === "string" && ch.id
      ? ch.id
      : typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}`;
  const displayName =
    typeof ch.displayName === "string" && ch.displayName.trim()
      ? ch.displayName.trim()
      : "Companion";

  let next: Character = {
    id,
    displayName,
    raceId: String(ch.raceId || ""),
    subrace: (ch.subrace as Character["subrace"]) || null,
    alignment: (ch.alignment as Character["alignment"]) || { alignmentId: "" },
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
    xp: typeof ch.xp === "number" ? ch.xp : 0,
  };

  if (!next.abilityScoresAssigned) {
    next.abilityScores = baseAbilityScores(catalog);
  } else if (!next.abilityScores) {
    next.abilityScores = baseAbilityScores(catalog);
  }

  for (const ab of ABILITY_ORDER) {
    if (next.abilityScores[ab] == null) next.abilityScores[ab] = pointFallback(catalog);
  }

  next = ensureUnlocked(next);
  next = normalizeEarnedFeatures(catalog, next);

  if (next.activeJob?.kind === "activity" && !next.activeJob.skillId) {
    const job = next.activeJob;
    const match = catalog.skills.find(
      (s) =>
        s.activity === job.activity &&
        featureLabel(s.feature) === featureLabel(job.feature),
    );
    if (match) next.activeJob = { ...job, skillId: match.id };
    else next.activeJob = null;
  }

  return next;
}

function pointFallback(catalog: Catalog) {
  return catalog.abilityMods?.pointBuy?.startingScore ?? 8;
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
  if (!ch.raceId) return "Missing race";
  if (!ch.alignment?.alignmentId) return "Missing alignment";
  return null;
}

/** Assign a display name when missing (e.g. migration). */
export function ensureDisplayName(
  ch: Character,
  taken: string[],
): Character {
  if (ch.displayName?.trim()) return ch;
  const named = generateUniqueFantasyName(ch.raceId, taken);
  return { ...ch, displayName: named.name };
}
