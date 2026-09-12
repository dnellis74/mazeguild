/** Attack-roll cantrips used in combat. Sacred Flame is save-based and excluded. */
export const CLASS_ATTACK_CANTRIP: Readonly<Record<string, string>> = {
  Wizard: "Fire Bolt",
  Sorcerer: "Fire Bolt",
  Druid: "Produce Flame",
  Warlock: "Eldritch Blast",
};

export const ATTACK_CANTRIPS = new Set(Object.values(CLASS_ATTACK_CANTRIP));

export function defaultAttackCantrip(archetype: string): string | undefined {
  return CLASS_ATTACK_CANTRIP[archetype];
}
