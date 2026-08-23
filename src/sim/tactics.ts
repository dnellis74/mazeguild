import type { Combatant } from "./types";

export type Intent =
  | { type: "heal"; targetId: string }
  | { type: "attack"; targetId: string }
  | { type: "none" };

function living(list: Combatant[]): Combatant[] {
  return list.filter((c) => c.alive);
}

function byId(a: Combatant, b: Combatant): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Action and target selection. No dice, no HP mutation.
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

  const sorted = [...foes].sort((a, b) => {
    if (actor.role === "dps") return a.hp - b.hp || byId(a, b);
    return b.hp - a.hp || byId(a, b);
  });
  return { type: "attack", targetId: sorted[0].id };
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
