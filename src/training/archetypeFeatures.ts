/**
 * Standard two starter skills for each class archetype (level-1 SRD pair).
 * Values are catalog skill ids from `public/data/skills.json`.
 *
 * Fighter: Defense fighting style + Second Wind (one of several style choices).
 */
export const ARCHETYPE_STARTER_FEATURES = {
  Barbarian: ["f_01r8k4", "f_02m7q9"], // Rage, Unarmored Defense
  Bard: ["f_03x5n2", "f_04p6t8"], // Bardic Inspiration & Cantrips, Bardic Spellcasting
  Cleric: ["f_05k2v7", "f_06q9m3"], // Divine Cantrips, Divine Spellcasting & Domain
  Druid: ["f_07n4r6", "f_08t1x5"], // Druidic & Cantrips, Primal Spellcasting
  Fighter: ["f_09b2s4", "f_10q5k7"], // Defense, Second Wind
  Monk: ["f_11x3n9", "f_12r6m4"], // Unarmored Defense, Martial Arts
  Paladin: ["f_13k8t2", "f_14p3x7"], // Divine Sense, Lay on Hands
  Ranger: ["f_15m9q5", "f_16n4k8"], // Favored Enemy, Natural Explorer
  Rogue: ["f_17x7r3", "f_18q2m6"], // Expertise & Thieves' Cant, Sneak Attack
  Sorcerer: ["f_21r8x2", "f_20k4n7"], // Sorcerous Origin & Cantrips, Innate Spellcasting
  Warlock: ["f_22p5t7", "f_23m3k9"], // Otherworldly Patron & Cantrips, Pact Magic
  Wizard: ["f_24q7n4", "f_25x2r8"], // Arcane Spellcasting & Cantrips, Arcane Recovery
} as const satisfies Record<string, readonly [string, string]>;

export type ClassArchetype = keyof typeof ARCHETYPE_STARTER_FEATURES;

export const CLASS_ARCHETYPES = Object.keys(
  ARCHETYPE_STARTER_FEATURES,
) as ClassArchetype[];

/** Case-insensitive lookup; returns null if unknown. */
export function resolveArchetype(name: string): ClassArchetype | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  for (const key of CLASS_ARCHETYPES) {
    if (key.toLowerCase() === needle) return key;
  }
  return null;
}

/** Starter skill-id pair for an archetype name (e.g. "cleric"). */
export function featuresForArchetype(
  name: string,
): [string, string] | null {
  const arch = resolveArchetype(name);
  if (!arch) return null;
  const pair = ARCHETYPE_STARTER_FEATURES[arch];
  return [pair[0], pair[1]];
}
