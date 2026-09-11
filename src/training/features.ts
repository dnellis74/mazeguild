import type { Character, FeatureRef, Skill } from "./types";
import type { Catalog } from "./catalog";
import { skillById } from "./catalog";

export function asFeatureList(feature: FeatureRef | undefined | null): string[] {
  if (Array.isArray(feature)) return feature.filter(Boolean).map(String);
  if (feature == null || feature === "") return [];
  return [String(feature)];
}

export function featureLabel(feature: FeatureRef | undefined | null): string {
  return asFeatureList(feature).join(" & ");
}

export function hasSkill(ch: Character, id: string | undefined | null): boolean {
  if (!id) return false;
  return (ch.features || []).some((f) => f.id === id);
}

export function prereqMet(ch: Character, skill: Skill): boolean {
  const p = skill.prerequisite;
  if (p == null || p === "") return true;
  if (Array.isArray(p)) return p.every((id) => hasSkill(ch, id));
  return hasSkill(ch, p);
}

export function earnedArchetypes(ch: Character): string[] {
  const seen: string[] = [];
  for (const f of ch.features || []) {
    if (!seen.includes(f.archetype)) seen.push(f.archetype);
  }
  return seen;
}

export function earnedFeatureNames(ch: Character, archetype?: string): string[] {
  return (ch.features || [])
    .filter((f) => !archetype || f.archetype === archetype)
    .flatMap((f) => asFeatureList(f.feature));
}

export function normalizeEarnedFeatures(catalog: Catalog, ch: Character): Character {
  const features = (ch.features || []).map((f) => {
    let next = { ...f };
    if (!next.id) {
      const match = catalog.skills.find(
        (s) =>
          s.activity === f.activity &&
          featureLabel(s.feature) === featureLabel(f.feature),
      );
      if (match) next = { ...next, id: match.id };
    }
    return { ...next, feature: asFeatureList(next.feature) };
  });
  return { ...ch, features };
}

export function availableActivities(
  activities: { id: string }[],
  ch: Character,
  catalog: Catalog,
) {
  return activities.filter((act) => {
    const skill = skillById(catalog, act.id);
    return skill ? prereqMet(ch, skill) : false;
  });
}
