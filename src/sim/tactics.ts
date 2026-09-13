import type { Combatant } from "./types";

export type Intent =
  | { type: "heal"; targetId: string }
  | { type: "attack"; targetId: string; ability?: string }
  | { type: "control"; ability: string }
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

/**
 * Action and target selection. No dice, no HP mutation.
 * Priority: heal wounded ally → control (≥2 living foes) → auto spell →
 * cantrip → weapon.
 * A later motivation prompt will bias this layer only.
 */
export function chooseAction(
  actor: Combatant,
  allies: Combatant[],
  enemies: Combatant[],
): Intent {
  const foes = living(enemies);
  if (foes.length === 0) return { type: "none" };

  const canHeal = actor.healSlots > 0 || actor.layOnHands > 0;
  if (canHeal) {
    const wounded = living(allies)
      .filter((a) => a.hp / a.maxHp < 0.9)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || byId(a, b));
    if (wounded[0]) return { type: "heal", targetId: wounded[0].id };
  }

  // Pool control (Sleep): only when at least two living foes remain.
  if (actor.controlSpell && actor.spellSlots > 0 && foes.length >= 2) {
    return { type: "control", ability: actor.controlSpell };
  }

  const sorted = [...foes].sort((a, b) => {
    if (actor.role === "dps") return a.hp - b.hp || byId(a, b);
    return b.hp - a.hp || byId(a, b);
  });
  const targetId = sorted[0]!.id;

  if (actor.spell && actor.spellSlots > 0) {
    return { type: "attack", targetId, ability: actor.spell };
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
