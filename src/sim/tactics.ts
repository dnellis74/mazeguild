import type { Combatant } from "./types";

export type Intent =
  | { type: "heal"; targetId: string; ability?: string }
  | { type: "stabilize"; targetId: string; ability?: string }
  | { type: "attack"; targetId: string; ability?: string }
  | { type: "control"; ability: string }
  | { type: "save"; ability: string }
  | { type: "buff"; ability: string }
  | { type: "rage"; mode: "enter" | "end" }
  | { type: "second_wind" }
  | { type: "none" };

export type ReactionIntent =
  | { type: "reaction"; ability: string }
  | { type: "none" };

export type BeforeDamageContext = {
  /** Attack roll total (d20 + bonuses). */
  total: number;
  /** Natural 20 — always hits; Shield cannot cancel. */
  crit: boolean;
  /** Defender AC before any new reaction this trigger. */
  ac: number;
};

function living(list: Combatant[]): Combatant[] {
  return list.filter((c) => c.alive);
}

function byId(a: Combatant, b: Combatant): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Allies below this HP fraction are heal candidates. */
const WOUNDED_HP_FRAC = 0.9;

function pickWoundedAlly(allies: Combatant[]): Combatant | undefined {
  return living(allies)
    .filter((a) => a.hp / a.maxHp < WOUNDED_HP_FRAC)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || byId(a, b))[0];
}

/**
 * Bonus-action slot: Healing Word, Second Wind, or Barbarian Rage enter.
 * Design simplification: AI always resolves bonus before action (not player-chosen order).
 *
 * Voluntary End Rage is a valid Intent (`{ type: "rage", mode: "end" }`) for the
 * resolver, but this function never chooses it — structurally available, unreachable
 * via current tactics policy.
 */
export function chooseBonusAction(
  actor: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
): Intent {
  if (
    actor.bonusHealSpell === "Healing Word" &&
    actor.spellSlots > 0
  ) {
    const wounded = pickWoundedAlly(allies);
    if (wounded) {
      return {
        type: "heal",
        targetId: wounded.id,
        ability: "Healing Word",
      };
    }
  }

  // Second Wind: self-heal when wounded (same HP threshold as other heals).
  if (
    actor.secondWindAvailable &&
    actor.alive &&
    actor.hp / actor.maxHp < WOUNDED_HP_FRAC
  ) {
    return { type: "second_wind" };
  }

  // Rage: enter on first turn with living foes (same practical timing as the
  // old auto-trigger, but consumes the bonus-action slot).
  if (
    actor.archetype === "Barbarian" &&
    !actor.raging &&
    actor.ragesRemaining > 0 &&
    living(enemies).length > 0
  ) {
    return { type: "rage", mode: "enter" };
  }

  return { type: "none" };
}

function pickDyingAlly(allies: Combatant[]): Combatant | undefined {
  return living(allies)
    .filter((a) => a.hp <= 0 && !a.stable)
    .sort(byId)[0];
}

/**
 * Action-slot selection. No dice, no HP mutation.
 * Priority: Spare the Dying → Cure Wounds / Lay on Hands → Bless → control →
 * AoE save → auto spell → leveled attack spell → cantrip → weapon.
 * Healing Word is not chosen here (bonus-action slot only).
 */
export function chooseAction(
  actor: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
): Intent {
  // Spare the Dying: before other action heals / attacks (stabilize dying allies).
  if (actor.stabilizeCantrip === "Spare the Dying") {
    const dying = pickDyingAlly(allies);
    if (dying) {
      return {
        type: "stabilize",
        targetId: dying.id,
        ability: "Spare the Dying",
      };
    }
  }

  const foes = living(enemies);
  if (foes.length === 0) return { type: "none" };

  // Action heal: Cure Wounds (healSlots) or Lay on Hands — not Healing Word.
  const canActionHeal =
    (actor.healSlots > 0 &&
      (!actor.healSpell || actor.healSpell === "Cure Wounds")) ||
    actor.layOnHands > 0;
  if (canActionHeal) {
    const wounded = pickWoundedAlly(allies);
    if (wounded) {
      return {
        type: "heal",
        targetId: wounded.id,
        ability: actor.healSlots > 0 ? actor.healSpell || "Cure Wounds" : undefined,
      };
    }
  }

  // Bless once when not concentrating and ≥2 living allies (incl. self).
  if (
    actor.buffSpell &&
    actor.spellSlots > 0 &&
    !actor.concentratingOn &&
    living(allies).length >= 2
  ) {
    return { type: "buff", ability: actor.buffSpell };
  }

  if (actor.controlSpell && actor.spellSlots > 0 && foes.length >= 2) {
    return { type: "control", ability: actor.controlSpell };
  }

  if (actor.saveSpell && actor.spellSlots > 0 && foes.length >= 2) {
    return { type: "save", ability: actor.saveSpell };
  }

  const sorted = [...foes].sort((a, b) => {
    if (actor.role === "dps") return a.hp - b.hp || byId(a, b);
    return b.hp - a.hp || byId(a, b);
  });
  const targetId = sorted[0]!.id;

  if (actor.spell && actor.spellSlots > 0) {
    return { type: "attack", targetId, ability: actor.spell };
  }
  if (actor.attackSpell && actor.spellSlots > 0) {
    return { type: "attack", targetId, ability: actor.attackSpell };
  }
  if (actor.cantrip) {
    return { type: "attack", targetId, ability: actor.cantrip };
  }
  return { type: "attack", targetId };
}

/**
 * before_damage reaction policy (Shield):
 * Cast only when +5 AC would turn this hit into a miss.
 * Skip crits (nat 20 always hits), attacks that still hit with +5, and
 * when no slots / reaction already spent / spell not learned.
 * No rng — pure decision.
 */
export function chooseBeforeDamageReaction(
  defender: Combatant,
  ctx: BeforeDamageContext,
): ReactionIntent {
  if (!defender.reactionSpell || defender.reactionSpell !== "Shield") {
    return { type: "none" };
  }
  if (defender.reactionUsed || defender.spellSlots <= 0) {
    return { type: "none" };
  }
  if (ctx.crit) return { type: "none" };
  const boosted = ctx.ac + 5;
  if (ctx.total >= boosted) return { type: "none" };
  if (ctx.total < ctx.ac) return { type: "none" };
  return { type: "reaction", ability: "Shield" };
}

/** after_damage hook — reserved (e.g. Hellish Rebuke). Unused this pass. */
export function chooseAfterDamageReaction(
  _defender: Combatant,
): ReactionIntent {
  return { type: "none" };
}

/** Enemies pick a uniformly random living party member (seeded). */
export function chooseEnemyAction(
  rng: () => number,
  party: Combatant[],
): Intent {
  const targets = living(party);
  if (targets.length === 0) return { type: "none" };
  return {
    type: "attack",
    targetId: targets[Math.floor(rng() * targets.length)].id,
  };
}
