import { makeMonster } from "./adapter";
import {
  generateEncounter,
  type EncounterMonsterGroup,
} from "./encounterScaling";
import type { Rng } from "./rng";
import type { Combatant, Weapon } from "./types";

const SCIMITAR: Weapon = {
  name: "Scimitar",
  damage: { count: 1, sides: 6 },
  damageType: "slashing",
  properties: ["Finesse", "Light"],
  finesse: true,
  ranged: false,
};

const LONGSWORD: Weapon = {
  name: "Longsword",
  damage: { count: 1, sides: 8 },
  damageType: "slashing",
  properties: ["Versatile (1d10)"],
  finesse: false,
  ranged: false,
};

const GOBLIN = {
  STR: 8,
  DEX: 14,
  CON: 10,
  INT: 10,
  WIS: 8,
  CHA: 8,
};

const HOBGOBLIN = {
  STR: 13,
  DEX: 12,
  CON: 12,
  INT: 10,
  WIS: 10,
  CHA: 9,
};

/** Flavor only. No mechanical effect in this layer. */
export const LOOT = [
  "a handful of copper coins",
  "a rusty dagger",
  "a wheel of moldy cheese",
  "a tarnished silver ring",
  "a torn map fragment",
  "a vial of murky liquid",
  "a goblin ear",
  "a cracked gemstone",
  "an old boot",
  "a bundle of arrows",
  "a small brass key",
  "a moth-eaten cloak",
] as const;

const AVAILABLE_MONSTERS = ["Goblin", "Hobgoblin"] as const;

type MonsterBlueprint = {
  ac: number;
  hp: number;
  abilities: Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", number>;
  weapon: Weapon;
  xpValue: number;
};

const MONSTER_STATS: Record<string, MonsterBlueprint> = {
  Goblin: {
    ac: 15,
    hp: 7,
    abilities: GOBLIN,
    weapon: SCIMITAR,
    xpValue: 50,
  },
  Hobgoblin: {
    ac: 18,
    hp: 11,
    abilities: HOBGOBLIN,
    weapon: LONGSWORD,
    xpValue: 100,
  },
};

function expandGroups(
  groups: EncounterMonsterGroup[],
  step: number,
): Combatant[] {
  const enemies: Combatant[] = [];
  let index = 0;
  for (const group of groups) {
    const stats = MONSTER_STATS[group.type];
    if (!stats) continue;
    for (let n = 0; n < group.count; n++) {
      index += 1;
      enemies.push(
        makeMonster({
          id: `mon-${step}-${index}`,
          name: `${group.type} ${index}`,
          ac: stats.ac,
          hp: stats.hp,
          abilities: stats.abilities,
          weapon: stats.weapon,
          xpValue: stats.xpValue,
        }),
      );
    }
  }
  return enemies;
}

/**
 * Build combatants for one maze encounter.
 * Difficulty is fixed to easy for now; the generator is already parameterized.
 */
export function spawnEncounter(
  rng: Rng,
  step: number,
  party: { level: number }[],
): Combatant[] {
  const seed = Math.floor(rng() * 0x100000000) >>> 0;
  const plan = generateEncounter(
    party,
    "easy",
    seed,
    [...AVAILABLE_MONSTERS],
  );
  const enemies = expandGroups(plan.monsters, step);
  if (enemies.length > 0) return enemies;

  // Last resort if the tables somehow yield an empty mix.
  return expandGroups([{ type: "Goblin", count: 1 }], step);
}

export function pickLoot(rng: Rng): string {
  return LOOT[Math.floor(rng() * LOOT.length)];
}
