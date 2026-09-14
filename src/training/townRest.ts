import { levelForXp } from "@/sim/leveling";
import type { Character } from "@/training/types";

/** Feature points granted each time a companion gains a level (town return). */
export const FEATURE_POINTS_PER_LEVEL = 2;

/**
 * Hit-die pool size equals character level (one die per level).
 * Town return restores the full pool — intentionally NOT the SRD long-rest
 * “regain half your total Hit Dice (round down)” formula. Returning to town
 * is a complete recovery point by design.
 */
export function hitDiceTotalFor(ch: Pick<Character, "xp">): number {
  return Math.max(1, levelForXp(ch.xp ?? 0));
}

export type TownReturnLevelUp = {
  fromLevel: number;
  toLevel: number;
  levelsGained: number;
  featurePointsGranted: number;
};

/**
 * Full town recovery after a maze run: max HP, full Hit Dice, XP write-back.
 * When XP crosses one or more level thresholds, grant a Hit Die (pool =
 * level) and {@link FEATURE_POINTS_PER_LEVEL} feature points per level gained.
 *
 * Short-/long-rest combat resources (Second Wind, Rage uses, spell slots,
 * Lay on Hands, raging/conditions/concentration) are not stored on Character;
 * each new run rebuilds combatants at full via companionToCombatant.
 */
export function restoreAfterTownReturn(
  ch: Character,
  xp: number,
): { character: Character; levelUp: TownReturnLevelUp | null } {
  const fromLevel = levelForXp(ch.xp ?? 0);
  const toLevel = levelForXp(xp);
  const levelsGained = Math.max(0, toLevel - fromLevel);
  const featurePointsGranted = levelsGained * FEATURE_POINTS_PER_LEVEL;
  const total = hitDiceTotalFor({ xp });

  const character: Character = {
    ...ch,
    xp,
    hp: null,
    hitDiceTotal: total,
    hitDiceRemaining: total,
    featurePoints:
      Math.max(0, Math.floor(ch.featurePoints ?? 0)) + featurePointsGranted,
  };

  const levelUp: TownReturnLevelUp | null =
    levelsGained > 0
      ? { fromLevel, toLevel, levelsGained, featurePointsGranted }
      : null;

  return { character, levelUp };
}
