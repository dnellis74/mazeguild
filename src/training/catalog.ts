import skills from "../../public/data/skills.json";
import races from "../../public/data/races.json";
import alignments from "../../public/data/alignments.json";
import timing from "../../public/data/training-timing.json";
import favoredEnemy from "../../public/data/favored-enemy.json";
import abilityMods from "../../public/data/ability-modifiers.json";
import backstoryPrompt from "../../public/data/backstory-prompt.json";
import cantripData from "../../public/data/cantrips.json";
import spellData from "../../public/data/spells_level1.json";
import type { Skill } from "./types";

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
  if (Array.isArray(data)) {
    return { known: {} as Record<string, number>, spells: data };
  }
  return {
    known: data.known || {},
    spells: data.spells || [],
  };
}

let cached: Catalog | null = null;

export function getCatalog(): Catalog {
  if (cached) return cached;
  const c = loadCantrips();
  const s = loadSpells();
  cached = {
    skills: skills as Skill[],
    races: races as Race[],
    alignments: alignments as Alignment[],
    timing: timing as Catalog["timing"],
    favoredEnemy: favoredEnemy as Catalog["favoredEnemy"],
    abilityMods: abilityMods as Catalog["abilityMods"],
    backstoryPrompt: backstoryPrompt as Catalog["backstoryPrompt"],
    cantripKnown: c.known,
    cantrips: c.cantrips,
    spellKnown: s.known,
    spells: s.spells,
  };
  return cached;
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
