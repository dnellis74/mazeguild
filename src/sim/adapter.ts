import { ABILITY_ORDER, type Ability } from "@/lib/abilities";
import { pickLearnedAttackCantrip } from "./cantrips";
import {
  getSpell,
  pickLearnedAttackSpell,
  pickLearnedAutoSpell,
  pickLearnedBonusHealSpell,
  pickLearnedBuffSpell,
  pickLearnedControlSpell,
  pickLearnedHealSpell,
  pickLearnedReactionSpell,
  pickLearnedSaveSpell,
} from "./spells";
import { abilityMod } from "./rules";
import { levelForXp, rageDamageForLevel, ragesForLevel } from "./leveling";
import type { Rng } from "./rng";
import {
  armorFromEquipmentId,
  ensureCharacterEquipment,
  normalizeEquipment,
  shieldAcBonus,
  weaponFromEquipmentId,
} from "./loadout";
import {
  defaultUnarmedWeapon,
  monkUnarmedWeapon,
} from "./weapons";
import type { Combatant, PartySnapshot, Role, Weapon } from "./types";
import type { Character } from "@/training/types";
import { asFeatureList } from "@/training/features";
import { characterLabel, titleCaseId } from "@/training/companion";

/** Hit die by feature archetype — used only to derive starting HP. */
const ARCHETYPE_HIT_DIE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
};

const TANK_ARCHETYPES = new Set(["Barbarian", "Fighter", "Paladin"]);
const HEALER_ARCHETYPES = new Set(["Cleric", "Druid", "Bard"]);
const SPELL_HEALER_ARCHETYPES = new Set([
  "Cleric",
  "Druid",
  "Bard",
  "Ranger",
]);

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

function featureText(ch: Character): string {
  return (ch.features || [])
    .flatMap((f) => asFeatureList(f.feature))
    .join(" ");
}

function archetypesOf(ch: Character): string[] {
  const seen: string[] = [];
  for (const f of ch.features || []) {
    if (f.archetype && !seen.includes(f.archetype)) seen.push(f.archetype);
  }
  return seen;
}

function roleFor(archetypes: string[], features: string): Role {
  if (
    archetypes.some((a) => HEALER_ARCHETYPES.has(a)) ||
    /Lay on Hands/i.test(features)
  ) {
    return "healer";
  }
  if (archetypes.some((a) => TANK_ARCHETYPES.has(a))) return "tank";
  return "dps";
}

function hitDieFor(archetypes: string[]): number {
  let best = 8;
  for (const a of archetypes) {
    const die = ARCHETYPE_HIT_DIE[a];
    if (die != null && die > best) best = die;
  }
  return best;
}

function level1Slots(archetypes: string[]): number {
  if (archetypes.includes("Warlock")) return 1;
  if (
    archetypes.some((a) =>
      ["Bard", "Cleric", "Druid", "Sorcerer", "Wizard"].includes(a),
    )
  ) {
    return 2;
  }
  return 0;
}

function pickSpellAbility(archetypes: string[]): Ability {
  for (const a of archetypes) {
    const ab = SPELL_ABILITY[a];
    if (ab) return ab;
  }
  return "WIS";
}

const FIGHTING_STYLE_NAMES = [
  "Archery",
  "Defense",
  "Dueling",
  "Great Weapon Fighting",
  "Protection",
  "Two-Weapon Fighting",
] as const;

/**
 * Collect earned fighting-style feature names (exact match).
 * Training does not enforce exclusivity (six Drill Yard skills, all prereq-null);
 * if more than one is somehow earned, warn and keep all flags for visibility.
 */
function collectFightingStyles(ch: Character): string[] {
  const earned = new Set(
    (ch.features || []).flatMap((f) => asFeatureList(f.feature)),
  );
  const styles = FIGHTING_STYLE_NAMES.filter((n) => earned.has(n));
  if (styles.length > 1) {
    console.warn(
      `[sim] companion ${ch.id || ch.name} has multiple Fighting Styles (${styles.join(", ")}); training should allow only one — applying all earned styles defensively`,
    );
  }
  return [...styles];
}

function resolveWeapon(ch: Character, archetypes: string[]): Weapon {
  const id = normalizeEquipment(ch.equipment).mainHand;
  if (id) {
    const fromEquip = weaponFromEquipmentId(id);
    if (fromEquip) return fromEquip;
  }
  if (archetypes.includes("Monk")) return monkUnarmedWeapon();
  return defaultUnarmedWeapon();
}

function hasUnarmoredDefense(archetypes: string[]): "barbarian" | "monk" | null {
  if (archetypes.includes("Barbarian")) return "barbarian";
  if (archetypes.includes("Monk")) return "monk";
  return null;
}

function armorClass(
  ch: Character,
  scores: Record<Ability, number>,
  archetypes: string[],
  fightingStyles: string[],
): number {
  const dex = abilityMod(scores.DEX ?? 10);
  const unarmored = hasUnarmoredDefense(archetypes);
  // Unarmored Defense always wins over any armor slot.
  if (unarmored === "barbarian") {
    return 10 + dex + abilityMod(scores.CON ?? 10);
  }
  if (unarmored === "monk") {
    return 10 + dex + abilityMod(scores.WIS ?? 10);
  }

  const eq = normalizeEquipment(ch.equipment);
  const armor = eq.armor ? armorFromEquipmentId(eq.armor) : null;
  let ac: number;
  if (armor) {
    ac = armor.baseAC;
    if (armor.dexCap === null) ac += dex;
    else if (armor.dexCap > 0) ac += Math.min(dex, armor.dexCap);
  } else {
    ac = 10 + dex;
  }
  if (eq.offHand === "shield") ac += shieldAcBonus();
  if (armor && fightingStyles.includes("Defense")) ac += 1;
  return ac;
}

/**
 * Map a companion onto a combat runtime fighter.
 * Combat reads inventory (equipment), features / cantrips / spells / race / scores.
 * Empty slots are filled from the primary archetype before resolving weapon/AC.
 * Optional rng picks among multiple learned attack cantrips (seeded).
 */
export function companionToCombatant(
  ch: Character,
  index: number,
  rng?: Rng,
): Combatant {
  ch = ensureCharacterEquipment(ch);
  const abilities = {
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
  } satisfies Record<Ability, number>;
  for (const abi of ABILITY_ORDER) {
    abilities[abi] = ch.abilityScores?.[abi] ?? 10;
  }

  const archetypes = archetypesOf(ch);
  const features = featureText(ch);
  const fightingStyles = collectFightingStyles(ch);
  const race = titleCaseId(ch.raceId);
  const hitDie = hitDieFor(archetypes);
  const maxHp = Math.max(1, hitDie + abilityMod(abilities.CON));
  const hp =
    typeof ch.hp === "number" && Number.isFinite(ch.hp)
      ? Math.min(Math.max(0, Math.floor(ch.hp)), maxHp)
      : maxHp;
  const slots = level1Slots(archetypes);
  const spellAbility = pickSpellAbility(archetypes);
  const primary = archetypes[0] || "Companion";
  const cantrip = pickLearnedAttackCantrip(ch.cantrips, rng);
  const spell = pickLearnedAutoSpell(ch.spells);
  const attackSpell = pickLearnedAttackSpell(ch.spells);
  const controlSpell = pickLearnedControlSpell(ch.spells);
  const saveSpell = pickLearnedSaveSpell(ch.spells);
  const buffSpell = pickLearnedBuffSpell(ch.spells);
  const reactionSpell = pickLearnedReactionSpell(ch.spells, "before_damage");
  const healSpell = pickLearnedHealSpell(ch.spells);
  const bonusHealSpell = pickLearnedBonusHealSpell(ch.spells);
  const healDice = healSpell
    ? (getSpell(healSpell)?.healDice ?? { count: 1, sides: 8 })
    : { count: 1, sides: 8 };
  const level = levelForXp(ch.xp ?? 0);
  const isBarbarian = archetypes.includes("Barbarian");
  const hasSecondWind = /\bSecond Wind\b/i.test(features);

  return {
    id: ch.id || `pc-${index}`,
    name: ch.name?.trim() || `${race} ${primary}`,
    kind: "pc",
    archetype: primary,
    race,
    role: roleFor(archetypes, features),
    abilities,
    proficiencyBonus: 2,
    ac: armorClass(ch, abilities, archetypes, fightingStyles),
    maxHp,
    hp,
    alive: hp > 0,
    // Casters keep a weapon for turns with no attack cantrip (and for display).
    weapon: resolveWeapon(ch, archetypes),
    cantrip,
    spell,
    attackSpell,
    controlSpell,
    saveSpell,
    buffSpell,
    reactionSpell,
    healSpell,
    bonusHealSpell,
    fightingStyles,
    archery: fightingStyles.includes("Archery"),
    greatWeaponFighting: fightingStyles.includes("Great Weapon Fighting"),
    secondWindAvailable: hasSecondWind,
    secondWindLevel: hasSecondWind ? level : 0,
    lucky: /Lucky/i.test(features) || /halfling/i.test(ch.raceId),
    relentless:
      /Relentless Endurance/i.test(features) || /half-?orc/i.test(ch.raceId),
    relentlessUsed: false,
    reactionUsed: false,
    sneakAttackUsedThisTurn: false,
    tempAcBonus: 0,
    condition: null,
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    raging: false,
    ragesRemaining: isBarbarian ? ragesForLevel(level) : 0,
    rageDamage: isBarbarian ? rageDamageForLevel(level) : 0,
    rageMaintained: false,
    rageExpiresRound: null,
    concentratingOn: null,
    rollModifiers: [],
    sneakAttackDice: /Sneak Attack/i.test(features) ? 1 : 0,
    healSlots: archetypes.some((a) => SPELL_HEALER_ARCHETYPES.has(a))
      ? slots
      : 0,
    layOnHands: /Lay on Hands/i.test(features) ? 5 : 0,
    spellSlots: slots,
    spellMod: abilityMod(abilities[spellAbility]),
    healDice,
    xp: ch.xp ?? 0,
    xpValue: 0,
  };
}

export function companionToPartySnapshot(
  ch: Character,
  index: number,
): PartySnapshot {
  const combatant = companionToCombatant(ch, index);
  return {
    name: characterLabel(ch),
    summary: combatant.archetype,
    race: combatant.race,
    hp: combatant.hp,
    maxHp: combatant.maxHp,
    ac: combatant.ac,
    xp: combatant.xp,
  };
}

export function makeMonster(opts: {
  id: string;
  name: string;
  ac: number;
  hp: number;
  abilities: Record<Ability, number>;
  weapon: Weapon;
  xpValue: number;
}): Combatant {
  return {
    id: opts.id,
    name: opts.name,
    kind: "monster",
    archetype: "Monster",
    race: "Monster",
    role: "dps",
    abilities: opts.abilities,
    proficiencyBonus: 2,
    ac: opts.ac,
    maxHp: opts.hp,
    hp: opts.hp,
    alive: true,
    weapon: opts.weapon,
    fightingStyles: [],
    archery: false,
    greatWeaponFighting: false,
    secondWindAvailable: false,
    secondWindLevel: 0,
    lucky: false,
    relentless: false,
    relentlessUsed: false,
    reactionUsed: false,
    sneakAttackUsedThisTurn: false,
    tempAcBonus: 0,
    condition: null,
    immunities: [],
    resistances: [],
    vulnerabilities: [],
    raging: false,
    ragesRemaining: 0,
    rageDamage: 0,
    rageMaintained: false,
    rageExpiresRound: null,
    concentratingOn: null,
    rollModifiers: [],
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellSlots: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: opts.xpValue,
  };
}
