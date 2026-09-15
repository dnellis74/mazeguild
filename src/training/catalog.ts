import skills from "@/data/skills.json";
import races from "@/data/races.json";
import alignments from "@/data/alignments.json";
import timing from "@/data/training-timing.json";
import favoredEnemy from "@/data/favored-enemy.json";
import abilityMods from "@/data/ability-modifiers.json";
import backstoryPrompt from "@/data/backstory-prompt.json";
import cantripData from "@/data/cantrips.json";
import spellData from "@/data/spells_level1.json";
import spellDataL2 from "@/data/spells_level2.json";
import type { Skill } from "./types";
import {
  DEV_SHOW_PLACEHOLDERS,
  getStatus,
  type SpellStatus,
} from "./spellStatus";

/** Archetypes whose activities, cantrips, and spells are offered in training. */
export const ACTIVE_ARCHETYPES = [
  "Cleric",
  "Fighter",
  "Rogue",
  "Wizard",
] as const;

export type ActiveArchetype = (typeof ACTIVE_ARCHETYPES)[number];

export type CatalogOptions = {
  /**
   * Archetypes included in offerable skills / cantrips / spells.
   * Defaults to ACTIVE_ARCHETYPES. Pass a wider list in tests that need
   * inactive archetypes through the gated catalog path.
   */
  archetypes?: readonly string[];
  /**
   * Spell/cantrip statuses included in offer lists.
   * Defaults to implemented only (plus placeholder when DEV_SHOW_PLACEHOLDERS).
   * Tests covering deferred magic may pass all three statuses explicitly.
   */
  spellStatuses?: readonly SpellStatus[];
};

export type Race = {
  id: string;
  name: string;
  flavor?: string;
  subraces?: { id: string; label: string; sourced?: boolean; blurb?: string }[];
};

export type Alignment = {
  id: string;
  name: string;
  law?: number;
  good?: number;
  flavor?: string;
};

export type Catalog = {
  /** Which archetypes this catalog instance offers (from getCatalog options). */
  offerArchetypes: readonly string[];
  /** Which spell/cantrip statuses this catalog instance offers. */
  offerStatuses: readonly SpellStatus[];
  skills: Skill[];
  races: Race[];
  alignments: Alignment[];
  timing: {
    unlock: { fills: number; fillMsSec: number };
    featureDefault: { fills: number; fillMsSec: number };
  };
  favoredEnemy: Record<string, { enemy: string; hunted: string }>;
  abilityMods: typeof abilityMods;
  backstoryPrompt: typeof backstoryPrompt;
  cantripKnown: Record<string, number>;
  cantrips: { id: number; archetype: string; name: string; description?: string }[];
  spellKnown: Record<string, number>;
  spells: {
    id: number;
    archetypes: string[];
    level: number;
    name: string;
    description?: string;
  }[];
};

function loadCantrips() {
  const data = cantripData as
    | { known?: Record<string, number>; cantrips?: Catalog["cantrips"] }
    | Catalog["cantrips"];
  if (Array.isArray(data)) {
    return { known: {} as Record<string, number>, cantrips: data };
  }
  return {
    known: data.known || {},
    cantrips: data.cantrips || [],
  };
}

function loadSpells() {
  const data = spellData as
    | { known?: Record<string, number>; spells?: Catalog["spells"] }
    | Catalog["spells"];
  const l1 = Array.isArray(data)
    ? { known: {} as Record<string, number>, spells: data }
    : {
        known: data.known || {},
        spells: data.spells || [],
      };
  const l2raw = spellDataL2 as {
    known?: Record<string, number>;
    spells?: Catalog["spells"];
  };
  const l2spells: Catalog["spells"] = Array.isArray(l2raw)
    ? l2raw
    : l2raw.spells || [];
  // Allowance counts stay on the 1st-level file; level-2 rows are catalog only.
  return {
    known: l1.known,
    spells: [...l1.spells, ...l2spells] as Catalog["spells"],
  };
}

function knownForArchetypes(
  known: Record<string, number>,
  allowed: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [arch, n] of Object.entries(known)) {
    if (allowed.has(arch)) out[arch] = n;
  }
  return out;
}

/** True when this catalog instance offers the given archetype. */
export function isOfferArchetype(catalog: Catalog, archetype: string): boolean {
  return catalog.offerArchetypes.includes(archetype);
}

const cache = new Map<string, Catalog>();

function cacheKey(
  archetypes: readonly string[],
  spellStatuses: readonly SpellStatus[],
): string {
  return `${[...archetypes].join("\0")}::${[...spellStatuses].join(",")}`;
}

function defaultOfferStatuses(): SpellStatus[] {
  return DEV_SHOW_PLACEHOLDERS
    ? ["implemented", "placeholder"]
    : ["implemented"];
}

export function getCatalog(options?: CatalogOptions): Catalog {
  const offerArchetypes = options?.archetypes ?? ACTIVE_ARCHETYPES;
  const offerStatuses = options?.spellStatuses ?? defaultOfferStatuses();
  const key = cacheKey(offerArchetypes, offerStatuses);
  const hit = cache.get(key);
  if (hit) return hit;

  const allowed = new Set(offerArchetypes);
  const statuses = new Set(offerStatuses);
  const c = loadCantrips();
  const s = loadSpells();
  const allSkills = skills as Skill[];

  const catalog: Catalog = {
    offerArchetypes,
    offerStatuses,
    skills: allSkills.filter((sk) => allowed.has(sk.archetype)),
    races: races as Race[],
    alignments: alignments as Alignment[],
    timing: timing as Catalog["timing"],
    favoredEnemy: favoredEnemy as Catalog["favoredEnemy"],
    abilityMods: abilityMods as Catalog["abilityMods"],
    backstoryPrompt: backstoryPrompt as Catalog["backstoryPrompt"],
    cantripKnown: knownForArchetypes(c.known, allowed),
    cantrips: c.cantrips.filter(
      (row) => allowed.has(row.archetype) && statuses.has(getStatus(row.name)),
    ),
    spellKnown: knownForArchetypes(s.known, allowed),
    spells: s.spells
      .filter(
        (row) =>
          row.archetypes.some((a) => allowed.has(a)) &&
          statuses.has(getStatus(row.name)),
      )
      .map((row) => ({
        ...row,
        // Offer only under active (allowed) archetypes on the row.
        archetypes: row.archetypes.filter((a) => allowed.has(a)),
      })),
  };
  cache.set(key, catalog);
  return catalog;
}

export function skillById(catalog: Catalog, id: string | undefined | null) {
  if (!id) return undefined;
  return catalog.skills.find((s) => s.id === id);
}

export function raceById(catalog: Catalog, id: string | undefined | null) {
  if (!id) return undefined;
  return catalog.races.find((r) => r.id === id);
}

export function alignmentById(catalog: Catalog, id: string | undefined | null) {
  if (!id) return undefined;
  return catalog.alignments.find((a) => a.id === id);
}
