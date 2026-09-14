import { ensureCharacterEquipment } from "@/sim/loadout";
import { assignAbilityScores } from "./abilities";
import {
  featuresForArchetype,
} from "./archetypeFeatures";
import type { Catalog } from "./catalog";
import { alignmentById, raceById, skillById } from "./catalog";
import { createEmptyCompanion } from "./companion";
import { asFeatureList, hasSkill, prereqMet } from "./features";
import {
  cantripsForArchetype,
  cantripsRemaining,
  openCantripSlots,
  openSpellSlots,
  ownedCantrips,
  ownedSpells,
  spellsForArchetype,
  spellsRemaining,
} from "./magic";
import type { Character, Skill } from "./types";

export type GenerateCharacterInput = {
  id: string;
  name: string;
  raceId: string;
  alignmentId: string;
  /**
   * Exactly two skill ids or feature names. Optional when `archetype` is set
   * (uses that class's standard starter pair).
   */
  features?: [string, string];
  /** Class archetype, e.g. "Cleric" / "cleric" — expands to starter features. */
  archetype?: string;
  subrace?: Character["subrace"];
  definingExperience?: Character["alignment"]["definingExperience"];
  /** Optional PRNG for ability leftover spend + magic picks (tests). */
  rng?: () => number;
};

export type GenerateCharacterError = {
  error: string;
};

/**
 * Resolve a skill by id, or uniquely by feature label / name (case-insensitive).
 */
export function resolveSkillRef(
  catalog: Catalog,
  ref: string,
): Skill | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const byId = skillById(catalog, trimmed);
  if (byId) return byId;

  const needle = trimmed.toLowerCase();
  const matches = catalog.skills.filter((s) => {
    const label = asFeatureList(s.feature).join(" & ").toLowerCase();
    if (label === needle) return true;
    return asFeatureList(s.feature).some((n) => n.toLowerCase() === needle);
  });
  return matches.length === 1 ? matches[0]! : null;
}

/** Order two skills so prerequisites within the pair are earned first. */
export function orderSkillsForEarn(a: Skill, b: Skill): [Skill, Skill] | null {
  const aNeedsB =
    a.prerequisite === b.id ||
    (Array.isArray(a.prerequisite) && a.prerequisite.includes(b.id));
  const bNeedsA =
    b.prerequisite === a.id ||
    (Array.isArray(b.prerequisite) && b.prerequisite.includes(a.id));
  if (aNeedsB && bNeedsA) return null;
  if (aNeedsB) return [b, a];
  if (bNeedsA) return [a, b];
  return [a, b];
}

function favoredEnemyDetail(catalog: Catalog, raceId: string): string {
  const race = raceById(catalog, raceId);
  const entry = race ? catalog.favoredEnemy[race.name] : null;
  if (entry?.enemy) return entry.enemy;
  const first = Object.values(catalog.favoredEnemy)[0];
  return first?.enemy ?? "Orcs";
}

function earnSkill(
  catalog: Catalog,
  ch: Character,
  skill: Skill,
): Character | GenerateCharacterError {
  if (hasSkill(ch, skill.id)) {
    return { error: `Already has feature ${skill.id}` };
  }
  if (!prereqMet(ch, skill)) {
    return {
      error: `Prerequisite not met for ${asFeatureList(skill.feature).join(" & ")} (${skill.id})`,
    };
  }
  if (ch.featurePoints <= 0) {
    return { error: "No feature points remaining" };
  }

  let detail = skill.detail ?? null;
  if (skill.id === "f_15m9q5" && !detail) {
    detail = favoredEnemyDetail(catalog, ch.raceId);
  }

  return {
    ...ch,
    featurePoints: ch.featurePoints - 1,
    features: [
      ...ch.features,
      {
        id: skill.id,
        feature: asFeatureList(skill.feature),
        archetype: skill.archetype,
        detail,
        description: skill.description || null,
        area: skill.area,
        building: skill.building,
        room: skill.room,
        activity: skill.activity,
      },
    ],
  };
}

/** Fill open cantrip/spell slots with catalog options (rng picks). */
export function fillMagicSlots(
  catalog: Catalog,
  ch: Character,
  rng: () => number = Math.random,
): Character {
  let next = ch;
  for (const slot of openCantripSlots(catalog, next)) {
    let remaining = slot.remaining;
    const pool = [...cantripsForArchetype(catalog, slot.archetype)];
    while (remaining > 0 && pool.length > 0) {
      const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
      const pick = pool.splice(idx, 1)[0]!;
      if (
        ownedCantrips(next, slot.archetype).some(
          (c) => String(c.id) === String(pick.id),
        )
      ) {
        continue;
      }
      next = {
        ...next,
        cantrips: [
          ...(next.cantrips || []),
          {
            id: pick.id,
            name: pick.name,
            archetype: pick.archetype,
            description: pick.description || "",
          },
        ],
      };
      remaining = cantripsRemaining(catalog, next, slot.archetype);
    }
  }
  for (const slot of openSpellSlots(catalog, next)) {
    let remaining = slot.remaining;
    const pool = [...spellsForArchetype(catalog, slot.archetype)];
    while (remaining > 0 && pool.length > 0) {
      const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
      const pick = pool.splice(idx, 1)[0]!;
      if (
        ownedSpells(next, slot.archetype).some(
          (s) => String(s.id) === String(pick.id),
        )
      ) {
        continue;
      }
      next = {
        ...next,
        spells: [
          ...(next.spells || []),
          {
            id: pick.id,
            name: pick.name,
            archetype: slot.archetype,
            level: pick.level,
            description: pick.description || "",
          },
        ],
      };
      remaining = spellsRemaining(catalog, next, slot.archetype);
    }
  }
  return next;
}

/**
 * Build a combat-ready character: race + alignment + exactly two features,
 * then equipment, ability scores, and auto-picked cantrips/spells.
 */
export function generateCharacter(
  catalog: Catalog,
  input: GenerateCharacterInput,
): Character | GenerateCharacterError {
  if (!raceById(catalog, input.raceId)) {
    return { error: `Unknown raceId: ${input.raceId}` };
  }
  if (!alignmentById(catalog, input.alignmentId)) {
    return { error: `Unknown alignmentId: ${input.alignmentId}` };
  }

  let featureRefs = input.features;
  if ((!featureRefs || featureRefs.length !== 2) && input.archetype) {
    const fromArch = featuresForArchetype(input.archetype);
    if (!fromArch) {
      return { error: `Unknown archetype: ${input.archetype}` };
    }
    featureRefs = fromArch;
  }
  if (!featureRefs || featureRefs.length !== 2) {
    return {
      error:
        "Provide archetype (e.g. Cleric) or features as an array of exactly two skill ids or names",
    };
  }
  const [refA, refB] = featureRefs;
  if (typeof refA !== "string" || typeof refB !== "string") {
    return { error: "features must be strings" };
  }

  const skillA = resolveSkillRef(catalog, refA);
  if (!skillA) {
    return { error: `Unknown or ambiguous feature: ${refA}` };
  }
  const skillB = resolveSkillRef(catalog, refB);
  if (!skillB) {
    return { error: `Unknown or ambiguous feature: ${refB}` };
  }
  if (skillA.id === skillB.id) {
    return { error: "features must be two different skills" };
  }

  const ordered = orderSkillsForEarn(skillA, skillB);
  if (!ordered) {
    return { error: "features have circular prerequisites" };
  }

  const rng = input.rng ?? Math.random;
  let ch = createEmptyCompanion(catalog, {
    id: input.id,
    name: input.name,
    raceId: input.raceId,
    subrace: input.subrace ?? null,
    alignment: {
      alignmentId: input.alignmentId,
      definingExperience: input.definingExperience ?? null,
    },
  });

  for (const skill of ordered) {
    const earned = earnSkill(catalog, ch, skill);
    if ("error" in earned) return earned;
    ch = earned;
  }

  ch = ensureCharacterEquipment(ch);
  ch = assignAbilityScores(catalog, ch, rng);
  ch = fillMagicSlots(catalog, ch, rng);
  return ch;
}

export function isGenerateError(
  value: Character | GenerateCharacterError,
): value is GenerateCharacterError {
  return value != null && typeof value === "object" && "error" in value;
}
