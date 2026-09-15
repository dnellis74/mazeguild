/** Race-quiz scoring for character creation. Pure; no React / localStorage. */

export type RaceWeightMap = Record<string, number | undefined>;

export type RaceQuizOption = {
  label: string;
  w: RaceWeightMap;
};

export type RaceQuizQuestion = {
  text: string;
  options: RaceQuizOption[];
};

export type RaceQuizAnswer = {
  question: string;
  optionIndex: number;
  optionLabel: string;
} | null;

/** Quiz weight keys use compacted ids (halforc); race records use half-orc. */
export function normalizeRaceWeightId(id: string): string {
  if (id === "halforc") return "half-orc";
  if (id === "halfelf") return "half-elf";
  return id;
}

export function computeRaceTotals(
  raceIds: readonly string[],
  questions: readonly RaceQuizQuestion[],
  answers: readonly RaceQuizAnswer[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of raceIds) totals[id] = 0;

  answers.forEach((ans, i) => {
    if (!ans) return;
    const q = questions[i];
    const opt = q?.options[ans.optionIndex];
    if (!opt?.w) return;
    for (const [rawId, weight] of Object.entries(opt.w)) {
      if (typeof weight !== "number") continue;
      const raceId = normalizeRaceWeightId(rawId);
      if (raceId in totals) totals[raceId] = (totals[raceId] ?? 0) + weight;
    }
  });
  return totals;
}

/**
 * Top race by weight sum. Ties within 1 point (or all zeros) → human.
 */
export function computeSuggestion(
  raceIds: readonly string[],
  questions: readonly RaceQuizQuestion[],
  answers: readonly RaceQuizAnswer[],
): string {
  const totals = computeRaceTotals(raceIds, questions, answers);
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top[1] === 0) return "human";
  if (second && top[1] - second[1] < 1) return "human";
  return top[0];
}
