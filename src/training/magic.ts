import type { Catalog } from "./catalog";
import { earnedArchetypes, earnedFeatureNames, asFeatureList } from "./features";
import type { Character, KnownCantrip, KnownSpell } from "./types";

export function hasCantripAccess(ch: Character, archetype: string): boolean {
  return earnedFeatureNames(ch, archetype).some((n) => /cantrips/i.test(n));
}

export function hasFullSpellcasting(ch: Character, archetype: string): boolean {
  return earnedFeatureNames(ch, archetype).some(
    (n) => /spellcasting/i.test(n) || /^pact magic$/i.test(n),
  );
}

export function cantripAllowance(catalog: Catalog, ch: Character, archetype: string): number {
  const total = Number(catalog.cantripKnown[archetype]) || 0;
  if (!total) return 0;
  const half = Math.floor(total / 2);
  const access = hasCantripAccess(ch, archetype);
  const full = hasFullSpellcasting(ch, archetype);
  if (!access && !full) return 0;
  if (full) return total;
  return Math.max(half, 1);
}

export function ownedCantrips(ch: Character, archetype?: string): KnownCantrip[] {
  return (ch.cantrips || []).filter((c) => !archetype || c.archetype === archetype);
}

export function cantripsRemaining(
  catalog: Catalog,
  ch: Character,
  archetype: string,
): number {
  return Math.max(
    0,
    cantripAllowance(catalog, ch, archetype) - ownedCantrips(ch, archetype).length,
  );
}

export function spellAllowance(catalog: Catalog, ch: Character, archetype: string): number {
  if (!hasFullSpellcasting(ch, archetype)) return 0;
  return Number(catalog.spellKnown[archetype]) || 0;
}

export function ownedSpells(ch: Character, archetype?: string): KnownSpell[] {
  return (ch.spells || []).filter((s) => !archetype || s.archetype === archetype);
}

export function spellsRemaining(
  catalog: Catalog,
  ch: Character,
  archetype: string,
): number {
  return Math.max(
    0,
    spellAllowance(catalog, ch, archetype) - ownedSpells(ch, archetype).length,
  );
}

export function cantripRoomForArchetype(catalog: Catalog, archetype: string) {
  const skill = catalog.skills.find(
    (s) =>
      s.archetype === archetype &&
      asFeatureList(s.feature).some((n) => /cantrips/i.test(n)),
  );
  if (!skill) return null;
  return { area: skill.area, building: skill.building, room: skill.room };
}

export function spellcastingRoomForArchetype(catalog: Catalog, archetype: string) {
  const skill = catalog.skills.find(
    (s) =>
      s.archetype === archetype &&
      asFeatureList(s.feature).some(
        (n) => /spellcasting/i.test(n) || /^pact magic$/i.test(n),
      ),
  );
  if (!skill) return null;
  return { area: skill.area, building: skill.building, room: skill.room };
}

export function openCantripSlots(catalog: Catalog, ch: Character) {
  const arches = new Set([...earnedArchetypes(ch), ...Object.keys(catalog.cantripKnown)]);
  return [...arches]
    .filter((a) => cantripsRemaining(catalog, ch, a) > 0)
    .map((a) => ({
      archetype: a,
      remaining: cantripsRemaining(catalog, ch, a),
      allowance: cantripAllowance(catalog, ch, a),
      owned: ownedCantrips(ch, a).length,
    }));
}

export function openSpellSlots(catalog: Catalog, ch: Character) {
  const arches = new Set([...earnedArchetypes(ch), ...Object.keys(catalog.spellKnown)]);
  return [...arches]
    .filter((a) => spellsRemaining(catalog, ch, a) > 0)
    .map((a) => ({
      archetype: a,
      remaining: spellsRemaining(catalog, ch, a),
      allowance: spellAllowance(catalog, ch, a),
      owned: ownedSpells(ch, a).length,
    }));
}

export function cantripsForArchetype(catalog: Catalog, archetype: string) {
  return catalog.cantrips.filter((c) => c.archetype === archetype);
}

export function spellsForArchetype(catalog: Catalog, archetype: string) {
  return catalog.spells.filter((s) => s.archetype === archetype);
}
