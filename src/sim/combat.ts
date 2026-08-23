import { d, type Rng } from "./rng";
import {
  abilityMod,
  applyDamage,
  applyHeal,
  resolveAttack,
  resolveCureWounds,
} from "./rules";
import { chooseAction, chooseEnemyAction } from "./tactics";
import type { Combatant, LogEvent } from "./types";

function allyCount(actor: Combatant, party: Combatant[]): number {
  return party.filter((p) => p.alive && p.id !== actor.id).length;
}

function initiative(rng: Rng, c: Combatant): number {
  let roll = d(rng, 20);
  if (c.lucky && roll === 1) roll = d(rng, 20);
  return roll + abilityMod(c.abilities.DEX);
}

/**
 * One encounter. Mutates HP. Appends to the shared log.
 * Returns true if any party member is still alive.
 */
export function runCombat(
  rng: Rng,
  party: Combatant[],
  enemies: Combatant[],
  log: LogEvent[],
): boolean {
  let round = 0;
  while (party.some((p) => p.alive) && enemies.some((e) => e.alive)) {
    round += 1;
    if (round > 100) break;

    const actors = [...party, ...enemies].filter((c) => c.alive);
    const order = actors.map((c, index) => ({
      c,
      index,
      init: initiative(rng, c),
    }));
    order.sort((a, b) => b.init - a.init || a.index - b.index);

    for (const { c: actor } of order) {
      if (!actor.alive) continue;
      if (!party.some((p) => p.alive) || !enemies.some((e) => e.alive)) break;

      const allies = actor.kind === "pc" ? party : enemies;
      const foes = actor.kind === "pc" ? enemies : party;
      const intent =
        actor.kind === "pc"
          ? chooseAction(actor, allies, foes)
          : chooseEnemyAction(rng, party);

      if (intent.type === "none") continue;

      if (intent.type === "heal") {
        const target = allies.find((a) => a.id === intent.targetId);
        if (!target?.alive) continue;
        let amount = 0;
        if (actor.healSlots > 0) {
          actor.healSlots -= 1;
          amount = resolveCureWounds(rng, actor);
        } else if (actor.layOnHands > 0) {
          amount = Math.min(actor.layOnHands, target.maxHp - target.hp);
          actor.layOnHands -= amount;
        }
        if (amount <= 0) continue;
        applyHeal(target, amount);
        log.push({
          event: "heal",
          round,
          actor: actor.name,
          target: target.name,
          amount,
          targetHpAfter: target.hp,
        });
        continue;
      }

      const target = foes.find((f) => f.id === intent.targetId);
      if (!target?.alive) continue;
      const result = resolveAttack(
        rng,
        actor,
        target,
        actor.kind === "pc" ? allyCount(actor, party) : 1,
      );
      if (result.hit) {
        applyDamage(target, result.damage);
        log.push({
          event: "attack",
          round,
          actor: actor.name,
          target: target.name,
          hit: true,
          crit: result.crit,
          damage: result.damage,
          targetHpAfter: target.hp,
        });
        if (!target.alive) {
          log.push({ event: "death", round, name: target.name });
        }
      } else {
        log.push({
          event: "attack",
          round,
          actor: actor.name,
          target: target.name,
          hit: false,
        });
      }
    }
  }
  return party.some((p) => p.alive);
}
