import { makeMonster } from "./adapter";
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

/** 1–2 goblins; 10% chance each is a hobgoblin. SRD 5.1 stats. */
export function spawnEncounter(rng: Rng, step: number): Combatant[] {
  const count = 1 + Math.floor(rng() * 2);
  const enemies: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const hob = rng() < 0.1;
    enemies.push(
      hob
        ? makeMonster({
            id: `mon-${step}-${i}`,
            name: `Hobgoblin ${i + 1}`,
            ac: 18,
            hp: 11,
            abilities: HOBGOBLIN,
            weapon: LONGSWORD,
            xpValue: 100,
          })
        : makeMonster({
            id: `mon-${step}-${i}`,
            name: `Goblin ${i + 1}`,
            ac: 15,
            hp: 7,
            abilities: GOBLIN,
            weapon: SCIMITAR,
            xpValue: 50,
          }),
    );
  }
  return enemies;
}

export function pickLoot(rng: Rng): string {
  return LOOT[Math.floor(rng() * LOOT.length)];
}
