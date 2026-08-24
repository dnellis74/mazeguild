import weaponsData from "@/data/weapons.json";
import type { Weapon } from "./types";

type WeaponDef = {
  name: string;
  damage: { count: number; sides: number };
  damageType: string;
  properties: string[];
};

type WeaponsFile = {
  weapons: Record<string, WeaponDef>;
  class_fallback: Record<string, string>;
  monster_weapons: Record<string, string>;
};

const DATA = weaponsData as unknown as WeaponsFile;

function toWeapon(def: WeaponDef): Weapon {
  return {
    name: def.name,
    damage: def.damage,
    damageType: def.damageType,
    properties: def.properties,
    finesse: def.properties.some((p) => /finesse/i.test(p)),
    ranged: def.properties.some((p) => /ammunition/i.test(p)),
  };
}

export function getWeapon(key: string): Weapon {
  const def = DATA.weapons[key];
  if (!def) throw new Error(`Unknown weapon: ${key}`);
  return toWeapon(def);
}

export function classFallbackWeapon(className: string): Weapon {
  const key = DATA.class_fallback[className];
  return key ? getWeapon(key) : getWeapon("unarmed");
}

export function monkUnarmedWeapon(): Weapon {
  return getWeapon("monk_unarmed");
}

export function defaultUnarmedWeapon(): Weapon {
  return getWeapon("unarmed");
}

export function monsterWeapon(monsterType: string): Weapon {
  const key = DATA.monster_weapons[monsterType];
  if (!key) throw new Error(`Unknown monster weapon: ${monsterType}`);
  return getWeapon(key);
}
