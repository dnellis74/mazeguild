/** Attack-roll cantrips used in combat. Sacred Flame is save-based and excluded. */
export const CLASS_ATTACK_CANTRIP: Readonly<Record<string, string>> = {
  Wizard: "Fire Bolt",
  Sorcerer: "Fire Bolt",
  Druid: "Produce Flame",
  Warlock: "Eldritch Blast",
};
