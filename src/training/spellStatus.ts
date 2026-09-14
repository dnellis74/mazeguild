/**
 * Implementation status for spells and cantrips offered (or deferred) in training.
 * Status lives here — not in the JSON SRD catalog files.
 *
 * Dev toggle mirrors character-initialization.html's DEBUG_SHOW_WEIGHTS pattern:
 * a module-level const flipped by hand for local testing.
 */

export type SpellStatus = "implemented" | "placeholder" | "deferred";

/**
 * When true, offer lists also include "placeholder" entries (still gated by
 * ACTIVE_ARCHETYPES). Default false — production and normal tests stay strict.
 */
export const DEV_SHOW_PLACEHOLDERS = false;

/**
 * Milestone 2 shortlist entries with a verified combat resolver.
 * Do not add a name here without confirming a runtime effect path.
 */
const IMPLEMENTED: ReadonlySet<string> = new Set([
  "Fire Bolt",
  "Shocking Grasp",
  "Chill Touch",
  "Spare the Dying",
  "Magic Missile",
  "Shield",
  "Sleep",
  "Burning Hands",
  "Thunderwave",
  "Guiding Bolt",
  "Inflict Wounds",
  "Bless",
  "Cure Wounds",
  "Healing Word",
]);

/**
 * Milestone 2 shortlist entries without a combat resolver yet.
 */
const PLACEHOLDER: ReadonlySet<string> = new Set([
  "Sacred Flame",
  "Guidance",
  "Light",
  "Thaumaturgy",
  "Mage Hand",
  "Minor Illusion",
  "Shield of Faith",
  "Command",
  "Detect Magic",
  "Mage Armor",
  "Comprehend Languages",
  "Lesser Restoration",
  "Spiritual Weapon",
  "Hold Person",
  "Aid",
  "Prayer of Healing",
  "Scorching Ray",
  "Mirror Image",
  "Invisibility",
  "Knock",
]);

/** Full map: every shortlist name → status. Non-shortlist names are deferred via getStatus. */
export const SPELL_STATUS: Readonly<Record<string, SpellStatus>> = {
  ...Object.fromEntries([...IMPLEMENTED].map((n) => [n, "implemented" as const])),
  ...Object.fromEntries([...PLACEHOLDER].map((n) => [n, "placeholder" as const])),
};

/** Test-only overrides; cleared when the override scope ends. */
let statusOverrides: Map<string, SpellStatus> | null = null;

/**
 * Temporarily treat named spells/cantrips as a given status (e.g. mark a
 * now-deferred but still-tested effect as "implemented" for a test body).
 */
export function withSpellStatusOverrides<T>(
  overrides: Record<string, SpellStatus>,
  fn: () => T,
): T {
  const prev = statusOverrides;
  statusOverrides = new Map(Object.entries(overrides));
  try {
    return fn();
  } finally {
    statusOverrides = prev;
  }
}

export function getStatus(name: string): SpellStatus {
  const over = statusOverrides?.get(name);
  if (over) return over;
  return SPELL_STATUS[name] ?? "deferred";
}

/** True when this name may appear in training offer lists. */
export function isOfferableStatus(name: string): boolean {
  const status = getStatus(name);
  if (status === "implemented") return true;
  if (status === "placeholder" && DEV_SHOW_PLACEHOLDERS) return true;
  return false;
}

/**
 * Runtime guard: placeholder/deferred effects must not silently no-op.
 * Throws in development; logs an explicit error in production.
 */
export function assertSpellEffectAllowed(name: string): void {
  const status = getStatus(name);
  if (status === "implemented") return;
  const msg = `Spell/cantrip effect blocked: "${name}" is ${status} (not implemented for casting)`;
  if (process.env.NODE_ENV === "production") {
    console.error(msg);
    return;
  }
  throw new Error(msg);
}
