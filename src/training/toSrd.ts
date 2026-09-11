import { CLASSES } from "@/gen/data";
import { abilityMod } from "@/sim/rules";
import type { SrdCharacter } from "@/sim/types";
import type { Catalog } from "./catalog";
import { alignmentById, raceById } from "./catalog";
import { asFeatureList } from "./features";
import type { Ability, Character } from "./types";
import { ABILITY_ORDER } from "./types";

const SPELL_ABILITY: Record<string, Ability> = {
  Bard: "CHA",
  Cleric: "WIS",
  Druid: "WIS",
  Paladin: "CHA",
  Ranger: "WIS",
  Sorcerer: "CHA",
  Warlock: "CHA",
  Wizard: "INT",
};

function fmtMod(score: number): string {
  const m = abilityMod(score);
  return (m >= 0 ? "+" : "") + m;
}

function primaryClass(ch: Character): string {
  const first = ch.features?.[0]?.archetype;
  if (first && CLASSES[first]) return first;
  for (const f of ch.features || []) {
    if (CLASSES[f.archetype]) return f.archetype;
  }
  return "Fighter";
}

function level1Slots(className: string): number {
  if (className === "Warlock") return 1;
  if (["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"].includes(className)) {
    return 2;
  }
  return 0;
}

/** Map a training character onto the SRD blob the tavern / maze expect. */
export function trainingToSrd(catalog: Catalog, ch: Character): SrdCharacter {
  const race = raceById(catalog, ch.raceId);
  const align = alignmentById(catalog, ch.alignment.alignmentId);
  const className = primaryClass(ch);
  const classData = CLASSES[className];
  const scores = ch.abilityScores;
  const con = scores?.CON ?? 10;
  const dex = scores?.DEX ?? 10;
  const hitDie = classData?.hit_die ?? 10;
  const hp = hitDie + abilityMod(con);
  const ac = 10 + abilityMod(dex);

  const ability_scores = Object.fromEntries(
    ABILITY_ORDER.map((ab) => {
      const score = scores?.[ab] ?? 10;
      return [ab, { score, modifier: fmtMod(score) }];
    }),
  );

  const featureNames = (ch.features || []).flatMap((f) => asFeatureList(f.feature));
  const cantrips = (ch.cantrips || [])
    .filter((c) => !c.archetype || c.archetype === className)
    .map((c) => c.name);
  const spells = (ch.spells || [])
    .filter((s) => !s.archetype || s.archetype === className)
    .map((s) => s.name);

  const spellAbility = SPELL_ABILITY[className];
  const slots = level1Slots(className);
  let spellcasting: SrdCharacter["spellcasting"] = null;
  if (spellAbility && (cantrips.length || spells.length || slots > 0)) {
    const mod = abilityMod(scores?.[spellAbility] ?? 10);
    spellcasting = {
      ability: spellAbility,
      spell_save_dc: 8 + 2 + mod,
      spell_attack_bonus: fmtMod(2 + mod),
      spell_slots: slots > 0 ? { "1": slots } : {},
      cantrips_known: cantrips,
      spells_known: spells,
      spells_prepared: spells,
      spellbook: className === "Wizard" ? spells : undefined,
    };
  }

  const raceName = race?.name || "Human";
  const subraceLabel = ch.subrace?.label || null;

  return {
    name: "PLAYER",
    class: className,
    race: raceName,
    subrace: subraceLabel,
    alignment: align?.name,
    background: "Folk Hero",
    meta: {
      source: "training",
      level: 1,
      note: "Recruited from character creation",
    },
    xp: 0,
    ability_scores,
    proficiency_bonus: "+2",
    saving_throw_proficiencies: classData?.saving_throws ?? [],
    hit_points: {
      value: Math.max(1, hp),
      hit_die: `1d${hitDie}`,
      note: "from training export",
    },
    armor_class: {
      value: ac,
      calculation: `10 + DEX (${fmtMod(dex)})`,
    },
    speed: "30 ft.",
    class_features_level_1: featureNames,
    class_features: featureNames,
    spellcasting,
    equipment: {
      from_class: [],
      from_class_detail: [],
      from_background: [],
    },
  };
}
