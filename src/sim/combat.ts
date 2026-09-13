import { d, type Rng } from "./rng";
import {
  abilityMod,
  applyDamage,
  applyHeal,
  expireConditionIfDue,
  hasCondition,
  resolveAttack,
  resolveAutoSpell,
  resolveCureWounds,
  resolveHpPool,
  resolveSave,
  rollSpellDamage,
  setCondition,
  type AttackResult,
} from "./rules";
import {
  getSpell,
  isCombatAutoSpell,
  isCombatControlSpell,
  isCombatSaveSpell,
} from "./spells";
import {
  chooseAction,
  chooseAfterDamageReaction,
  chooseBeforeDamageReaction,
  chooseEnemyAction,
} from "./tactics";
import type { Ability, Combatant, LogEvent } from "./types";

function allyCount(actor: Combatant, party: Combatant[]): number {
  return party.filter((p) => p.alive && p.id !== actor.id).length;
}

function initiative(rng: Rng, c: Combatant): number {
  let roll = d(rng, 20);
  if (c.lucky && roll === 1) roll = d(rng, 20);
  return roll + abilityMod(c.abilities.DEX);
}

/** Start-of-turn refresh: reaction recharges; Shield AC bonus ends. */
function beginTurn(actor: Combatant, round: number): void {
  expireConditionIfDue(actor, round);
  actor.reactionUsed = false;
  actor.tempAcBonus = 0;
}

/**
 * before_damage: defender may cast Shield to raise AC and cancel a non-crit hit.
 * Returns the (possibly revised) attack result and optional reaction name.
 */
function runBeforeDamageReaction(
  defender: Combatant,
  result: AttackResult,
): { result: AttackResult; reaction?: string } {
  if (!result.hit || defender.kind !== "pc") {
    return { result };
  }

  const intent = chooseBeforeDamageReaction(defender, {
    total: result.total,
    crit: result.crit,
    ac: defender.ac + (defender.tempAcBonus || 0),
  });
  if (intent.type !== "reaction" || intent.ability !== "Shield") {
    return { result };
  }

  const spell = getSpell("Shield");
  const bonus = spell?.effect?.acBonus ?? 5;
  if (defender.spellSlots <= 0) return { result };

  defender.spellSlots -= 1;
  defender.reactionUsed = true;
  defender.tempAcBonus = Math.max(defender.tempAcBonus || 0, bonus);

  // Nat 20 remains a hit (crit ignores AC). Otherwise re-check total vs new AC.
  const newAc = defender.ac + defender.tempAcBonus;
  if (!result.crit && result.total < newAc) {
    return {
      result: {
        hit: false,
        crit: false,
        damage: 0,
        d20: result.d20,
        total: result.total,
      },
      reaction: "Shield",
    };
  }
  return { result, reaction: "Shield" };
}

/** after_damage placeholder — no listeners yet. */
function runAfterDamageReaction(defender: Combatant): void {
  chooseAfterDamageReaction(defender);
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

      beginTurn(actor, round);

      // Unconscious: still occupy a turn slot (beginTurn ran) but take no action.
      if (hasCondition(actor, "unconscious")) continue;

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
        let used = "";
        if (actor.healSlots > 0) {
          actor.healSlots -= 1;
          amount = resolveCureWounds(rng, actor);
          used = "Cure Wounds";
        } else if (actor.layOnHands > 0) {
          amount = Math.min(actor.layOnHands, target.maxHp - target.hp);
          actor.layOnHands -= amount;
          used = "Lay on Hands";
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
          used,
        });
        continue;
      }

      // HP-pool control (Sleep): foes only — RAW cone/radius ally catch omitted.
      if (
        intent.type === "control" &&
        actor.kind === "pc" &&
        actor.controlSpell === intent.ability &&
        actor.spellSlots > 0 &&
        isCombatControlSpell(intent.ability)
      ) {
        const spell = getSpell(intent.ability);
        if (spell?.condition && spell.pool) {
          actor.spellSlots -= 1;
          const { pool, affected } = resolveHpPool(rng, spell, foes);
          const duration = spell.durationRounds ?? 10;
          const expiresRound = round + duration;
          for (const target of affected) {
            setCondition(target, spell.condition, expiresRound);
          }
          log.push({
            event: "control",
            round,
            actor: actor.name,
            used: intent.ability,
            pool,
            affected: affected.map((t) => t.name),
          });
          continue;
        }
      }

      // AoE save spells (Burning Hands / Thunderwave): one shared damage roll,
      // each living foe saves independently. Foes only — no positional model.
      if (
        intent.type === "save" &&
        actor.kind === "pc" &&
        actor.saveSpell === intent.ability &&
        actor.spellSlots > 0 &&
        isCombatSaveSpell(intent.ability)
      ) {
        const spell = getSpell(intent.ability);
        if (spell?.damage && spell.save) {
          actor.spellSlots -= 1;
          const damageFull = rollSpellDamage(rng, spell);
          const saveAbility = spell.save.ability as Ability;
          const onSuccess =
            spell.save.onSuccess === "half" ? "half" : "none";
          const pushOnFail = intent.ability === "Thunderwave";
          const targets = foes.filter((f) => f.alive);
          for (const target of targets) {
            const result = resolveSave(rng, actor, target, {
              ability: saveAbility,
              onSuccess,
              damageFull,
              pushOnFail,
            });
            applyDamage(target, result.damage);
            log.push({
              event: "save",
              round,
              actor: actor.name,
              target: target.name,
              used: intent.ability,
              dc: result.dc,
              d20: result.d20,
              total: result.total,
              success: result.success,
              damageFull: result.damageFull,
              damage: result.damage,
              targetHpAfter: target.hp,
              pushed: result.pushed || undefined,
            });
            runAfterDamageReaction(target);
            if (!target.alive) {
              log.push({ event: "death", round, name: target.name });
            }
          }
          continue;
        }
      }

      if (intent.type !== "attack") continue;

      const target = foes.find((f) => f.id === intent.targetId);
      if (!target?.alive) continue;
      const used = intent.ability ?? actor.weapon.name;

      // Auto-hit spells (Magic Missile): spend a slot, no to-hit roll.
      // Shield's Magic Missile clause is deferred (no enemy MM casters yet).
      if (
        actor.kind === "pc" &&
        intent.ability &&
        actor.spell === intent.ability &&
        actor.spellSlots > 0 &&
        isCombatAutoSpell(intent.ability)
      ) {
        const spell = getSpell(intent.ability);
        if (spell) {
          actor.spellSlots -= 1;
          const result = resolveAutoSpell(rng, spell);
          applyDamage(target, result.damage);
          log.push({
            event: "attack",
            round,
            actor: actor.name,
            target: target.name,
            hit: true,
            crit: false,
            damage: result.damage,
            targetHpAfter: target.hp,
            used,
          });
          runAfterDamageReaction(target);
          if (!target.alive) {
            log.push({ event: "death", round, name: target.name });
          }
          continue;
        }
      }

      let result = resolveAttack(
        rng,
        actor,
        target,
        actor.kind === "pc" ? allyCount(actor, party) : 1,
      );

      let reaction: string | undefined;
      if (result.hit) {
        const reacted = runBeforeDamageReaction(target, result);
        result = reacted.result;
        reaction = reacted.reaction;
      }

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
          used,
          reaction,
        });
        runAfterDamageReaction(target);
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
          used,
          reaction,
        });
      }
    }
  }
  return party.some((p) => p.alive);
}
