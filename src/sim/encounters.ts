import { makeMonster } from "./adapter";
import {
  generateEncounter,
  type EncounterMonsterGroup,
} from "./encounterScaling";
import type { Rng } from "./rng";
import type { CharacterEquipment } from "@/training/types";
import type { Combatant } from "./types";

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

/**
 * Monster blueprint. `equipment` uses the same `CharacterEquipment` shape as
 * PCs (`armor` / `mainHand` / `offHand` / `pack`). Combat weapon, AC, and
 * wearingMetalArmor are derived from equipment at spawn (not from a separate
 * monster_weapons table).
 */
export type MonsterBlueprint = {
  hp: number;
  speed: number;
  abilities: Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", number>;
  skills?: string[];
  senses?: string[];
  languages?: string[];
  challengeRating: number;
  xpValue: number;
  /** Named traits (e.g. Bugbear "Brute"). */
  features?: string[];
  equipment: CharacterEquipment;
};

export const MONSTER_STATS: Record<string, MonsterBlueprint> = {
  Goblin: {
    hp: 7,
    speed: 30,
    abilities: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
    senses: ["darkvision 60 ft.", "passive Perception 10"],
    languages: ["Common", "Goblin"],
    challengeRating: 0.25,
    xpValue: 50,
    features: ["Nimble Escape"],
    equipment: {
      armor: "leather",
      mainHand: "scimitar",
      offHand: "shield",
      pack: { name: "Carried", contents: ["shortbow"] },
    },
  },
  Hobgoblin: {
    hp: 11,
    speed: 30,
    abilities: { STR: 13, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 9 },
    senses: ["darkvision 60 ft.", "passive Perception 10"],
    languages: ["Common", "Goblin"],
    challengeRating: 0.5,
    xpValue: 100,
    features: ["Martial Advantage"],
    equipment: {
      armor: "chain_mail",
      mainHand: "longsword",
      offHand: "shield",
      // Longsword is Versatile (1d10), but shield occupies off hand → one-handed 1d8 only.
      pack: { name: "Carried", contents: ["longbow"] },
    },
  },
  Bugbear: {
    hp: 27,
    speed: 30,
    abilities: { STR: 15, DEX: 14, CON: 13, INT: 8, WIS: 11, CHA: 9 },
    challengeRating: 1,
    xpValue: 200,
    // Brute: melee weapon hits deal one extra die of damage (morningstar 1d8 → 2d8).
    features: ["Brute","Surprise Attack"],
    skills: ["stealth +6", "survival +2"],
    senses: ["darkvision 60 ft.", "passive Perception 10"],
    languages: ["Common", "Goblin"],
    equipment: {
      armor: "hide",
      mainHand: "morningstar",
      offHand: "shield",
      pack: { name: "Carried", contents: ["javelin"] },
    },
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
          hp: stats.hp,
          abilities: stats.abilities,
          equipment: stats.equipment,
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
  return LOOT[Math.floor(rng() * LOOT.length)];
}
