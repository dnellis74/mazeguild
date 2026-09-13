import { levelForXp } from "@/sim/leveling";
import type { Character } from "@/training/types";

/**
 * Hit-die pool size equals character level (one die per level).
 * Town return restores the full pool — intentionally NOT the SRD long-rest
 * “regain half your total Hit Dice (round down)” formula. Returning to town
 * is a complete recovery point by design.
 */
export function hitDiceTotalFor(ch: Pick<Character, "xp">): number {
  return Math.max(1, levelForXp(ch.xp ?? 0));
}

/**
 * Full town recovery after a maze run: max HP, full Hit Dice, XP write-back.
 * Short-/long-rest combat resources (Second Wind, Rage uses, spell slots,
 * Lay on Hands, raging/conditions/concentration) are not stored on Character;
 * each new run rebuilds combatants at full via companionToCombatant.
 */
export function restoreAfterTownReturn(ch: Character, xp: number): Character {
  const total = hitDiceTotalFor({ xp });
  return {
    ...ch,
    xp,
    hp: null,
    hitDiceTotal: total,
    hitDiceRemaining: total,
  };
}
