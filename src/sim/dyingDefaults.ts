/** Shared default fields for Combatant factories (tests + adapter). */
export const DYING_DEFAULTS = {
  tempHp: 0,
  deathSaveSuccesses: 0,
  deathSaveFailures: 0,
  stable: false,
} as const;

/** Hit Dice pool defaults (PCs start with one die; monsters unused). */
export const HIT_DICE_DEFAULTS = {
  hitDiceTotal: 1,
  hitDiceRemaining: 1,
  hitDieSides: 8,
} as const;
