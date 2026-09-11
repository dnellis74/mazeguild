import type { Catalog } from "./catalog";
import { raceById } from "./catalog";
import { earnedArchetypes } from "./features";
import {
  ABILITY_ORDER,
  ABILITY_SHORT_NAME,
  type Ability,
  type Character,
} from "./types";

export function abilityMod(score: number): number {
  return Math.floor((Number(score) - 10) / 2);
}

export function formatAbilityMod(score: number): string {
  const m = abilityMod(score);
  return (m >= 0 ? "+" : "") + m;
}

export function pointBuyStartingScore(catalog: Catalog): number {
  return catalog.abilityMods?.pointBuy?.startingScore ?? 8;
}

export function baseAbilityScores(catalog: Catalog): Record<Ability, number> {
  const start = pointBuyStartingScore(catalog);
  return Object.fromEntries(ABILITY_ORDER.map((ab) => [ab, start])) as Record<
    Ability,
    number
  >;
}

function pointBuyRaiseCost(
  score: number,
  costs: Record<string, number>,
): number {
  const next = score + 1;
  if (costs[String(next)] == null || costs[String(score)] == null) return Infinity;
  return costs[String(next)] - costs[String(score)];
}

/** After both feature draws: mins → random leftover point-buy → racial bonuses. */
export function assignAbilityScores(
  catalog: Catalog,
  ch: Character,
  rng: () => number = Math.random,
): Character {
  if (!ch.features || ch.features.length < 2) return ch;
  if (ch.abilityScoresAssigned) return ch;

  const pb = catalog.abilityMods.pointBuy;
  const costs = pb.costs as Record<string, number>;
  const start = pb.startingScore ?? 8;
  const maxPre = pb.maximumBeforeRacialBonuses ?? 15;
  let points = pb.points ?? 27;
  const scores = Object.fromEntries(ABILITY_ORDER.map((ab) => [ab, start])) as Record<
    Ability,
    number
  >;

  const mins: Partial<Record<Ability, number>> = {};
  const fighterAny: { short: Ability; min: number }[] = [];

  for (const arch of earnedArchetypes(ch)) {
    const spec = (
      catalog.abilityMods.archetypeMinimums as Record<string, Record<string, unknown>>
    )[arch];
    if (!spec) continue;
    if (Array.isArray(spec.any)) {
      for (const opt of spec.any as Record<string, number>[]) {
        for (const [full, min] of Object.entries(opt)) {
          const short = ABILITY_SHORT_NAME[full];
          if (short) fighterAny.push({ short, min });
        }
      }
      continue;
    }
    for (const [full, min] of Object.entries(spec)) {
      if (full === "any") continue;
      const short = ABILITY_SHORT_NAME[full];
      if (!short) continue;
      mins[short] = Math.max(mins[short] || 0, Number(min));
    }
  }

  for (const [short, min] of Object.entries(mins) as [Ability, number][]) {
    while (scores[short] < min) {
      const cost = pointBuyRaiseCost(scores[short], costs);
      if (!Number.isFinite(cost) || cost > points || scores[short] >= maxPre) break;
      points -= cost;
      scores[short] += 1;
    }
  }

  if (fighterAny.length) {
    const satisfied = fighterAny.some(({ short, min }) => scores[short] >= min);
    if (!satisfied) {
      const affordable = fighterAny.filter(({ short, min }) => {
        let trial = scores[short];
        let need = 0;
        while (trial < min) {
          const c = pointBuyRaiseCost(trial, costs);
          if (!Number.isFinite(c) || trial >= maxPre) return false;
          need += c;
          trial += 1;
        }
        return need <= points;
      });
      const pool = affordable.length ? affordable : fighterAny;
      const pick = pool[Math.floor(rng() * pool.length)]!;
      while (scores[pick.short] < pick.min) {
        const cost = pointBuyRaiseCost(scores[pick.short], costs);
        if (!Number.isFinite(cost) || cost > points || scores[pick.short] >= maxPre) {
          break;
        }
        points -= cost;
        scores[pick.short] += 1;
      }
    }
  }

  let guard = 200;
  while (points > 0 && guard-- > 0) {
    const candidates = ABILITY_ORDER.filter((ab) => {
      if (scores[ab] >= maxPre) return false;
      const cost = pointBuyRaiseCost(scores[ab], costs);
      return Number.isFinite(cost) && cost <= points;
    });
    if (!candidates.length) break;
    const ab = candidates[Math.floor(rng() * candidates.length)]!;
    const cost = pointBuyRaiseCost(scores[ab], costs);
    points -= cost;
    scores[ab] += 1;
  }

  const race = raceById(catalog, ch.raceId);
  const racial =
    (race &&
      (catalog.abilityMods.racialBonuses as Record<string, Record<string, number>>)[
        race.name
      ]) ||
    {};
  for (const [full, bonus] of Object.entries(racial)) {
    const short = ABILITY_SHORT_NAME[full];
    if (short) scores[short] += bonus;
  }

  return {
    ...ch,
    abilityScores: scores,
    abilityScoresAssigned: true,
    abilityPointsUnspent: points,
  };
}
