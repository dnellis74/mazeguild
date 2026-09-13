import { d, type Rng } from "./rng";
import {
  abilityMod,
  addRollModifier,
  applyDamage,
  applyHeal,
  beginRage,
  endConcentration,
  endRage,
  expireConditionIfDue,
  hasCondition,
  markRageAttack,
  removeRollModifier,
  resolveAttack,
  resolveAutoSpell,
  resolveCureWounds,
  resolveHealAmount,
  resolveHpPool,
  resolveSave,
  rollSpellDamage,
  setCondition,
  startConcentration,
  tickRageAtTurnStart,
  type AttackResult,
} from "./rules";
import { getCantrip } from "./cantrips";
import {
  getSpell,
  isCombatAttackSpell,
  isCombatAutoSpell,
  isCombatBuffSpell,
  isCombatControlSpell,
  isCombatSaveSpell,
} from "./spells";
import {
  chooseAction,
  chooseAfterDamageReaction,
  chooseBeforeDamageReaction,
  chooseBonusAction,
  chooseEnemyAction,
  type Intent,
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

/** Damage type for the ability/weapon used on this attack. */
function damageTypeForAttack(actor: Combatant, used: string): string {
  if (actor.cantrip && used === actor.cantrip) {
    const type = getCantrip(actor.cantrip)?.damage?.type;
    if (type) return type;
  }
  if (actor.spell && used === actor.spell) {
    const type = getSpell(actor.spell)?.damage?.type;
    if (type) return type;
  }
  if (actor.attackSpell && used === actor.attackSpell) {
    const type = getSpell(actor.attackSpell)?.damage?.type;
    if (type) return type;
  }
  return actor.weapon.damageType;
}

/** Start-of-turn refresh: reaction recharges; Shield AC bonus ends; Rage clock. */
function beginTurn(actor: Combatant, round: number): void {
  expireConditionIfDue(actor, round);
  actor.reactionUsed = false;
  actor.sneakAttackUsedThisTurn = false;
  actor.tempAcBonus = 0;
  // Rage early-end / 1-minute expiry (entry is a bonus-action Intent now).
  tickRageAtTurnStart(actor, round);
}

/** Clear Rage and concentration at encounter end. */
function clearEncounterState(combatants: Combatant[]): void {
  for (const c of combatants) {
    if (c.raging) endRage(c);
    if (c.concentratingOn) endConcentration(c);
  }
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

type TurnCtx = {
  rng: Rng;
  actor: Combatant;
  allies: Combatant[];
  foes: Combatant[];
  party: Combatant[];
  enemies: Combatant[];
  round: number;
  log: LogEvent[];
};

/**
 * Resolve one intent (bonus-action or action slot). Returns false if the
 * encounter should stop checking further intents this turn (wipe / no foes).
 */
function resolveIntent(ctx: TurnCtx, intentIn: Intent): boolean {
  const { rng, actor, allies, foes, party, round, log } = ctx;
  let intent = intentIn;

  if (intent.type === "none") return true;

  // Second Wind (bonus action): 1d10 + fighter level; once until short rest.
  if (intent.type === "second_wind") {
    if (!actor.secondWindAvailable || !actor.alive) return true;
    actor.secondWindAvailable = false;
    const amount = Math.max(
      1,
      d(rng, 10) + actor.secondWindLevel,
    );
    applyHeal(actor, amount);
    log.push({
      event: "heal",
      round,
      actor: actor.name,
      target: actor.name,
      amount,
      targetHpAfter: actor.hp,
      used: "Second Wind",
    });
    return true;
  }

  // Rage enter / voluntary end (bonus-action slot).
  if (intent.type === "rage") {
    if (intent.mode === "enter") {
      if (
        actor.archetype === "Barbarian" &&
        !actor.raging &&
        actor.ragesRemaining > 0
      ) {
        beginRage(actor, round);
        log.push({
          event: "rage",
          round,
          actor: actor.name,
          used: "Rage",
        });
      }
    } else if (intent.mode === "end" && actor.raging) {
      // Structurally available; tactics.ts never chooses this today.
      endRage(actor);
      log.push({
        event: "rage",
        round,
        actor: actor.name,
        used: "End Rage",
      });
    }
    return true;
  }

  // No spellcasting while raging (cantrips included). Lay on Hands is not a spell.
  if (actor.raging) {
    if (
      intent.type === "buff" ||
      intent.type === "control" ||
      intent.type === "save" ||
      (intent.type === "heal" && intent.ability)
    ) {
      return true;
    }
    if (intent.type === "attack" && intent.ability) {
      intent = { type: "attack", targetId: intent.targetId };
    }
  }

  if (intent.type === "heal") {
    const target = allies.find((a) => a.id === intent.targetId);
    if (!target?.alive) return true;
    let amount = 0;
    let used = "";

    if (intent.ability === "Healing Word") {
      // Bonus-action heal: learned check + shared spellSlots.
      if (
        actor.bonusHealSpell !== "Healing Word" ||
        actor.spellSlots <= 0
      ) {
        return true;
      }
      const spell = getSpell("Healing Word");
      const diceExpr = spell?.healDice ?? { count: 1, sides: 4 };
      actor.spellSlots -= 1;
      amount = resolveHealAmount(rng, actor, diceExpr);
      used = "Healing Word";
    } else if (actor.healSlots > 0) {
      actor.healSlots -= 1;
      amount = resolveCureWounds(rng, actor);
      used = intent.ability || actor.healSpell || "Cure Wounds";
    } else if (actor.layOnHands > 0) {
      amount = Math.min(actor.layOnHands, target.maxHp - target.hp);
      actor.layOnHands -= amount;
      used = "Lay on Hands";
    }
    if (amount <= 0) return true;
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
    return true;
  }

  // Bless: up to 3 living allies, concentration + rollModifiers.
  if (
    intent.type === "buff" &&
    actor.kind === "pc" &&
    actor.buffSpell === intent.ability &&
    actor.spellSlots > 0 &&
    isCombatBuffSpell(intent.ability)
  ) {
    actor.spellSlots -= 1;
    const targets = allies
      .filter((a) => a.alive)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, 3);
    const blessed = targets;
    startConcentration(actor, "Bless", round, () => {
      for (const t of blessed) {
        removeRollModifier(t, "Bless");
      }
    });
    for (const t of blessed) {
      addRollModifier(t, {
        source: "Bless",
        affects: "both",
        die: { count: 1, sides: 4 },
        sign: 1,
      });
    }
    log.push({
      event: "buff",
      round,
      actor: actor.name,
      used: "Bless",
      affected: blessed.map((t) => t.name),
    });
    return true;
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
    }
    return true;
  }

  // AoE save spells (Burning Hands / Thunderwave).
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
      const onSuccess = spell.save.onSuccess === "half" ? "half" : "none";
      const pushOnFail = intent.ability === "Thunderwave";
      const targets = foes.filter((f) => f.alive);
      for (const target of targets) {
        const result = resolveSave(rng, actor, target, {
          ability: saveAbility,
          onSuccess,
          damageFull,
          pushOnFail,
        });
        const applied = applyDamage(
          target,
          result.damage,
          spell.damage.type,
          rng,
        );
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
          damage: applied,
          targetHpAfter: target.hp,
          pushed: result.pushed || undefined,
        });
        runAfterDamageReaction(target);
        if (!target.alive) {
          log.push({ event: "death", round, name: target.name });
        }
      }
    }
    return party.some((p) => p.alive) && ctx.enemies.some((e) => e.alive);
  }

  if (intent.type !== "attack") return true;

  const target = foes.find((f) => f.id === intent.targetId);
  if (!target?.alive) return true;
  // Attacking a hostile (hit or miss) maintains Rage.
  markRageAttack(actor);
  const used = intent.ability ?? actor.weapon.name;

  // Auto-hit spells (Magic Missile).
  if (
    actor.kind === "pc" &&
    intent.ability &&
    actor.spell === intent.ability &&
    actor.spellSlots > 0 &&
    isCombatAutoSpell(intent.ability)
  ) {
    const spell = getSpell(intent.ability);
    if (spell?.damage) {
      actor.spellSlots -= 1;
      const result = resolveAutoSpell(rng, spell);
      const applied = applyDamage(
        target,
        result.damage,
        spell.damage.type,
        rng,
      );
      log.push({
        event: "attack",
        round,
        actor: actor.name,
        target: target.name,
        hit: true,
        crit: false,
        damage: applied,
        targetHpAfter: target.hp,
        used,
      });
      runAfterDamageReaction(target);
      if (!target.alive) {
        log.push({ event: "death", round, name: target.name });
      }
    }
    return party.some((p) => p.alive) && ctx.enemies.some((e) => e.alive);
  }

  // Leveled spell attacks (Guiding Bolt / Inflict Wounds).
  if (
    actor.kind === "pc" &&
    intent.ability &&
    actor.attackSpell === intent.ability &&
    actor.spellSlots > 0 &&
    isCombatAttackSpell(intent.ability)
  ) {
    const spell = getSpell(intent.ability);
    if (spell?.damage) {
      actor.spellSlots -= 1;
      let result = resolveAttack(
        rng,
        actor,
        target,
        actor.kind === "pc" ? allyCount(actor, party) : 1,
        { spellAttack: intent.ability },
      );

      let reaction: string | undefined;
      if (result.hit) {
        const reacted = runBeforeDamageReaction(target, result);
        result = reacted.result;
        reaction = reacted.reaction;
      }

      if (result.hit) {
        const applied = applyDamage(
          target,
          result.damage,
          spell.damage.type,
          rng,
        );
        if (spell.onHitCondition) {
          const dur = spell.conditionDurationRounds ?? 2;
          setCondition(target, spell.onHitCondition, round + dur);
        }
        log.push({
          event: "attack",
          round,
          actor: actor.name,
          target: target.name,
          hit: true,
          crit: result.crit,
          damage: applied,
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
    return party.some((p) => p.alive) && ctx.enemies.some((e) => e.alive);
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
    const dtype = damageTypeForAttack(actor, used);
    const applied = applyDamage(target, result.damage, dtype, rng);
    log.push({
      event: "attack",
      round,
      actor: actor.name,
      target: target.name,
      hit: true,
      crit: result.crit,
      damage: applied,
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
  return party.some((p) => p.alive) && ctx.enemies.some((e) => e.alive);
}

/**
 * One encounter. Mutates HP. Appends to the shared log.
 * Returns true if any party member is still alive.
 *
 * Turn structure: each living actor may resolve a bonus-action intent, then
 * an action intent (fixed AI order: bonus first — simplification of SRD
 * "choose the order"). Either slot may be empty. Reactions stay out-of-turn.
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

    log.push({
      event: "round_start",
      round,
      order: order.map(({ c }) => c.name),
    });

    for (const { c: actor } of order) {
      if (!actor.alive) continue;
      if (!party.some((p) => p.alive) || !enemies.some((e) => e.alive)) break;

      beginTurn(actor, round);

      // Unconscious: still occupy a turn slot (beginTurn ran) but take no actions.
      if (hasCondition(actor, "unconscious")) continue;

      const allies = actor.kind === "pc" ? party : enemies;
      const foes = actor.kind === "pc" ? enemies : party;
      const ctx: TurnCtx = {
        rng,
        actor,
        allies,
        foes,
        party,
        enemies,
        round,
        log,
      };

      // Bonus action first (PCs only; enemies have no bonus actions yet).
      if (actor.kind === "pc") {
        const bonus = chooseBonusAction(actor, allies, foes);
        if (!resolveIntent(ctx, bonus)) break;
      }

      if (!actor.alive) continue;
      if (!party.some((p) => p.alive) || !enemies.some((e) => e.alive)) break;

      // Action slot — chosen after bonus so spent slots / healed HP are visible.
      const action =
        actor.kind === "pc"
          ? chooseAction(actor, allies, foes)
          : chooseEnemyAction(rng, party);
      if (!resolveIntent(ctx, action)) break;
    }
  }
  clearEncounterState([...party, ...enemies]);
  return party.some((p) => p.alive);
}
