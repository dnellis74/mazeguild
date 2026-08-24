import { abilityMod } from "./rules";
import {
  classFallbackWeapon,
  monkUnarmedWeapon,
} from "./weapons";
import type {
  Ability,
  Combatant,
  DiceExpr,
  Role,
  SrdCharacter,
  Weapon,
} from "./types";

const ABILITIES: Ability[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

const TANK = new Set(["Barbarian", "Fighter", "Paladin"]);
const HEALER = new Set(["Cleric", "Druid", "Bard"]);
const SPELL_HEALER = new Set(["Cleric", "Druid", "Bard", "Ranger"]);

function parseDamage(text: string): { expr: DiceExpr; type: string } | null {
  const m = text.match(/(\d+)d(\d+)\s+(\w+)/i);
  if (!m) return null;
  return {
    expr: { count: Number(m[1]), sides: Number(m[2]) },
    type: m[3],
  };
}

function parseBonus(value: string | number): number {
  if (typeof value === "number") return value;
  return Number.parseInt(String(value).replace("+", ""), 10) || 2;
}

function roleFor(className: string): Role {
  if (TANK.has(className)) return "tank";
  if (HEALER.has(className)) return "healer";
  return "dps";
}

function weaponsFrom(ch: SrdCharacter): Weapon[] {
  const details = ch.equipment?.from_class_detail ?? [];
  const out: Weapon[] = [];
  for (const entry of details) {
    const stats = entry.stats;
    if (!stats || stats.type !== "weapon" || !stats.damage) continue;
    const parsed = parseDamage(stats.damage);
    if (!parsed) continue;
    const properties = stats.properties ?? [];
    out.push({
      name: stats.name ?? entry.item,
      damage: parsed.expr,
      damageType: parsed.type,
      properties,
      finesse: properties.some((p) => /finesse/i.test(p)),
      ranged: properties.some((p) => /ammunition/i.test(p)),
    });
  }
  return out;
}

function pickWeapon(ch: SrdCharacter, className: string): Weapon {
  const weapons = weaponsFrom(ch);
  const melee = weapons.filter((w) => !w.ranged);
  const pool = melee.length > 0 ? melee : weapons;
  if (pool.length > 0) {
    return pool.reduce((best, w) => {
      const avg = (w.damage.count * (w.damage.sides + 1)) / 2;
      const bestAvg = (best.damage.count * (best.damage.sides + 1)) / 2;
      return avg > bestAvg ? w : best;
    });
  }
  if (className === "Monk") {
    return monkUnarmedWeapon();
  }
  return classFallbackWeapon(className);
}

function traitsOf(ch: SrdCharacter): string {
  return [...(ch.racial_traits ?? []), ...(ch.class_features_level_1 ?? [])].join(
    " ",
  );
}

/** Map an SRD 5.1 character JSON blob onto a combatant. */
export function characterToCombatant(
  ch: SrdCharacter,
  index: number,
): Combatant {
  const abilities = {
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
  } satisfies Record<Ability, number>;
  for (const abi of ABILITIES) {
    abilities[abi] = ch.ability_scores?.[abi]?.score ?? 10;
  }

  const className = ch.class;
  const race = ch.race;
  const traits = traitsOf(ch);
  const spellAbility = (ch.spellcasting?.ability as Ability | undefined) ?? "WIS";
  const slots = ch.spellcasting?.spell_slots?.["1"] ?? 0;

  return {
    id: `pc-${index}`,
    name: ch.name?.trim() || `${race} ${className}`,
    kind: "pc",
    className,
    race,
    role: roleFor(className),
    abilities,
    proficiencyBonus: parseBonus(ch.proficiency_bonus),
    ac: ch.armor_class?.value ?? 10,
    maxHp: ch.hit_points?.value ?? 8,
    hp: ch.hit_points?.value ?? 8,
    alive: true,
    weapon: pickWeapon(ch, className),
    lucky: /Lucky/i.test(traits) || race === "Halfling",
    relentless: /Relentless Endurance/i.test(traits),
    relentlessUsed: false,
    sneakAttackDice: /Sneak Attack/i.test(traits) ? 1 : 0,
    healSlots: SPELL_HEALER.has(className) ? slots : 0,
    layOnHands: /Lay on Hands/i.test(traits) ? 5 : 0,
    spellMod: abilityMod(abilities[spellAbility]),
    healDice: { count: 1, sides: 8 },
    xp: ch.xp ?? 0,
    xpValue: 0,
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
    className: "Monster",
    race: "Monster",
    role: "dps",
    abilities: opts.abilities,
    proficiencyBonus: 2,
    ac: opts.ac,
    maxHp: opts.hp,
    hp: opts.hp,
    alive: true,
    weapon: opts.weapon,
    lucky: false,
    relentless: false,
    relentlessUsed: false,
    sneakAttackDice: 0,
    healSlots: 0,
    layOnHands: 0,
    spellMod: 0,
    healDice: { count: 1, sides: 8 },
    xp: 0,
    xpValue: opts.xpValue,
  };
}
