import { weaponFromEquipmentId } from "./loadout";
import type { Weapon } from "./types";

/** SRD unarmed strike (1 bludgeoning). Not catalog gear. */
export function defaultUnarmedWeapon(): Weapon {
  return {
    name: "Unarmed strike",
    damage: { count: 1, sides: 1 },
    damageType: "bludgeoning",
    properties: [],
    finesse: false,
    ranged: false,
  };
}

/** Monk Martial Arts unarmed strike (1d4 finesse). Not catalog gear. */
export function monkUnarmedWeapon(): Weapon {
  return {
    name: "Unarmed strike",
    damage: { count: 1, sides: 4 },
    damageType: "bludgeoning",
    properties: ["Finesse"],
    finesse: true,
    ranged: false,
  };
}

/**
 * Resolve a weapon by equipment.json id, or the special unarmed keys.
 * Prefer `weaponFromEquipmentId` for inventory slots.
 */
export function getWeapon(key: string): Weapon {
  if (key === "unarmed") return defaultUnarmedWeapon();
  if (key === "monk_unarmed") return monkUnarmedWeapon();
  const fromEquip = weaponFromEquipmentId(key);
  if (fromEquip) return fromEquip;
  throw new Error(`Unknown weapon: ${key}`);
}
