import { makeMonster } from "./adapter";
import {
  generateEncounter,
  type EncounterMonsterGroup,
} from "./encounterScaling";
import type { Rng } from "./rng";
import type { Combatant } from "./types";
import { MONSTER_STATS } from "@/data/monsters";
import type { CharacterEquipment } from "@/training/types";

export { MONSTER_STATS } from "@/data/monsters";
export type { MonsterBlueprint } from "@/data/monsters";

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

const AVAILABLE_MONSTERS = ["Goblin", "Hobgoblin", "Bugbear"] as const;

function equipmentOrEmpty(
  partial: Partial<CharacterEquipment> | undefined,
): CharacterEquipment {
  return {
    armor: partial?.armor ?? null,
    mainHand: partial?.mainHand ?? null,
    offHand: partial?.offHand ?? null,
    pack: partial?.pack ?? null,
  };
}

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
          hp: stats.hp,
          abilities: stats.abilities,
          equipment: equipmentOrEmpty(stats.equipment),
          features: stats.features,
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
  return LOOT[Math.floor(rng() * LOOT.length)]!;
}
