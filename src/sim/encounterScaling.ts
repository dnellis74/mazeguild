import encounterData from "@/data/encounter.json";
import { createRng } from "./rng";

export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly";

export type EncounterMonsterGroup = {
  type: string;
  count: number;
};

export type EncounterPlan = {
  monsters: EncounterMonsterGroup[];
  totalXP: number;
  adjustedXP: number;
  difficultyAchieved: string;
};

type DifficultyThresholds = {
  easy: number;
  medium: number;
  hard: number;
  deadly: number;
};

type EncounterTables = {
  xp_thresholds_by_character_level: Record<string, DifficultyThresholds>;
  encounter_multipliers: Record<string, number>;
  party_size_adjustment: {
    small_party_threshold: number;
    large_party_threshold: number;
    single_monster_multiplier_small_party: number;
    single_monster_multiplier_large_party: number;
  };
  monster_xp_reference: Record<
    string,
    { challenge_rating: string; xp: number }
  >;
};

const TABLES = encounterData as unknown as EncounterTables;

const DIFFICULTY_ORDER: EncounterDifficulty[] = [
  "easy",
  "medium",
  "hard",
  "deadly",
];

/** Ordered multiplier columns from the DMG table (party of 3–5). */
const MULTIPLIER_BUCKETS = [
  { key: "1", min: 1, max: 1 },
  { key: "2", min: 2, max: 2 },
  { key: "3-6", min: 3, max: 6 },
  { key: "7-10", min: 7, max: 10 },
  { key: "11-14", min: 11, max: 14 },
  { key: "15+", min: 15, max: Infinity },
] as const;

/** Prefer tougher monsters over larger packs for harder bands. */
const MAX_MONSTERS = 3;

export function monsterCountBucket(monsterCount: number): string {
  const count = Math.max(1, monsterCount);
  for (const bucket of MULTIPLIER_BUCKETS) {
    if (count >= bucket.min && count <= bucket.max) return bucket.key;
  }
  return "15+";
}

function baseMultiplier(monsterCount: number): number {
  const key = monsterCountBucket(monsterCount);
  return TABLES.encounter_multipliers[key] ?? 1;
}

function bucketIndex(monsterCount: number): number {
  const key = monsterCountBucket(monsterCount);
  return MULTIPLIER_BUCKETS.findIndex((bucket) => bucket.key === key);
}

/**
 * DMG encounter multiplier, including party-size column shifts.
 * Parties of 6+ use the next-lowest column (single monster → 0.5).
 */
export function encounterMultiplier(
  monsterCount: number,
  partySize: number,
): number {
  const adjust = TABLES.party_size_adjustment;
  const count = Math.max(1, monsterCount);

  if (partySize >= adjust.large_party_threshold) {
    if (count === 1) return adjust.single_monster_multiplier_large_party;
    const index = bucketIndex(count);
    const lower = MULTIPLIER_BUCKETS[Math.max(0, index - 1)]!;
    return TABLES.encounter_multipliers[lower.key] ?? 1;
  }

  if (partySize < adjust.small_party_threshold) {
    if (count === 1) return adjust.single_monster_multiplier_small_party;
    const index = bucketIndex(count);
    const higher =
      MULTIPLIER_BUCKETS[Math.min(MULTIPLIER_BUCKETS.length - 1, index + 1)]!;
    return TABLES.encounter_multipliers[higher.key] ?? 1;
  }

  return baseMultiplier(count);
}

export function characterThreshold(
  level: number,
  difficulty: EncounterDifficulty,
): number {
  const clamped = Math.min(20, Math.max(1, Math.floor(level)));
  const row = TABLES.xp_thresholds_by_character_level[String(clamped)];
  return row?.[difficulty] ?? 0;
}

export function partyThreshold(
  party: { level: number }[],
  difficulty: EncounterDifficulty,
): number {
  return party.reduce(
    (sum, member) => sum + characterThreshold(member.level, difficulty),
    0,
  );
}

export function partyThresholdBounds(
  party: { level: number }[],
  targetDifficulty: EncounterDifficulty,
): { lower: number; upper: number } {
  const lower = partyThreshold(party, targetDifficulty);
  const index = DIFFICULTY_ORDER.indexOf(targetDifficulty);
  const next = DIFFICULTY_ORDER[index + 1];
  const upper = next ? partyThreshold(party, next) : Number.POSITIVE_INFINITY;
  return { lower, upper };
}

export function monsterXp(type: string): number {
  return TABLES.monster_xp_reference[type]?.xp ?? 0;
}

export function totalMonsterXp(monsters: EncounterMonsterGroup[]): number {
  return monsters.reduce(
    (sum, group) => sum + monsterXp(group.type) * group.count,
    0,
  );
}

export function adjustedMonsterXp(
  monsters: EncounterMonsterGroup[],
  partySize: number,
): { totalXP: number; adjustedXP: number; monsterCount: number } {
  const monsterCount = monsters.reduce((sum, group) => sum + group.count, 0);
  const totalXP = totalMonsterXp(monsters);
  const adjustedXP = totalXP * encounterMultiplier(monsterCount, partySize);
  return { totalXP, adjustedXP, monsterCount };
}

export function difficultyAchievedFor(
  party: { level: number }[],
  adjustedXP: number,
): string {
  if (adjustedXP >= partyThreshold(party, "deadly")) return "deadly";
  if (adjustedXP >= partyThreshold(party, "hard")) return "hard";
  if (adjustedXP >= partyThreshold(party, "medium")) return "medium";
  if (adjustedXP >= partyThreshold(party, "easy")) return "easy";
  return "trivial";
}

function enumerateMixes(
  availableMonsters: string[],
  maxMonsters: number,
): EncounterMonsterGroup[][] {
  const types = availableMonsters.filter((type) => monsterXp(type) > 0);
  if (types.length === 0) return [];

  const out: EncounterMonsterGroup[][] = [];

  function rec(typeIndex: number, remaining: number, counts: number[]): void {
    if (typeIndex === types.length - 1) {
      counts.push(remaining);
      const monsters = types
        .map((type, index) => ({ type, count: counts[index]! }))
        .filter((group) => group.count > 0);
      if (monsters.length > 0) out.push(monsters);
      counts.pop();
      return;
    }
    for (let count = 0; count <= remaining; count++) {
      counts.push(count);
      rec(typeIndex + 1, remaining - count, counts);
      counts.pop();
    }
  }

  for (let total = 1; total <= maxMonsters; total++) {
    rec(0, total, []);
  }
  return out;
}

function planFromMonsters(
  party: { level: number }[],
  monsters: EncounterMonsterGroup[],
  partySize: number,
): EncounterPlan {
  const { totalXP, adjustedXP } = adjustedMonsterXp(monsters, partySize);
  return {
    monsters,
    totalXP,
    adjustedXP,
    difficultyAchieved: difficultyAchievedFor(party, adjustedXP),
  };
}

/**
 * Build an encounter whose adjusted XP lands in the target difficulty band.
 * Party size for multipliers comes from `party.length`; thresholds from levels.
 */
export function generateEncounter(
  party: { level: number }[],
  targetDifficulty: EncounterDifficulty,
  seed: number,
  availableMonsters: string[],
): EncounterPlan {
  const rng = createRng(seed >>> 0);
  const partySize = party.length;
  const { lower, upper } = partyThresholdBounds(party, targetDifficulty);
  const mixes = enumerateMixes(availableMonsters, MAX_MONSTERS);

  const fits: EncounterMonsterGroup[][] = [];
  let closest: EncounterMonsterGroup[] | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const monsters of mixes) {
    const { adjustedXP } = adjustedMonsterXp(monsters, partySize);
    if (adjustedXP >= lower && adjustedXP < upper) {
      fits.push(monsters);
      continue;
    }
    const distance =
      adjustedXP < lower ? lower - adjustedXP : adjustedXP - upper;
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = monsters;
    }
  }

  if (fits.length > 0) {
    const pick = fits[Math.floor(rng() * fits.length)]!;
    return planFromMonsters(party, pick, partySize);
  }

  if (closest) {
    return planFromMonsters(party, closest, partySize);
  }

  return {
    monsters: [],
    totalXP: 0,
    adjustedXP: 0,
    difficultyAchieved: "trivial",
  };
}
