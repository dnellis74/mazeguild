import alignmentQuestions from "@/data/alignment-questions.json";
import raceAlignment from "@/data/race-alignment.json";
import alignments from "@/data/alignments.json";
import type { Character } from "./types";

export type AlignmentQuestionOption = {
  id: string;
  label: string;
  law: number;
  good: number;
  track?: string;
};

export type AlignmentQuestion = {
  id: string;
  text: string;
  options: AlignmentQuestionOption[];
};

export type DefiningExperience = NonNullable<
  Character["alignment"]["definingExperience"]
>;

export type AlignQuizAnswer = {
  questionId: string;
  optionId: string;
  label: string;
} | null;

export type ResolvedAlignment = {
  law: number;
  good: number;
  lawSum: number;
  goodSum: number;
  lawRatio: number;
  goodRatio: number;
  alignmentId: string;
};

type AlignmentAxes = { id: string; law: number; good: number; name?: string };

type RaceAlignmentConfig = {
  extras?: Record<string, AlignmentQuestion[]>;
  overrides?: Record<string, Record<string, Partial<AlignmentQuestion>>>;
  skips?: Record<string, string[]>;
  axisBias?: Record<string, { law?: number; good?: number }>;
};

const ALIGNMENTS = alignments as AlignmentAxes[];
const BASE_QUESTIONS = alignmentQuestions as AlignmentQuestion[];
const RACE_CFG = raceAlignment as RaceAlignmentConfig;
const RACE_EXTRAS = RACE_CFG.extras ?? {};
const RACE_OVERRIDES = RACE_CFG.overrides ?? {};
const RACE_SKIPS = RACE_CFG.skips ?? {};
const RACE_AXIS_BIAS = RACE_CFG.axisBias ?? {};

const AXIS_THRESHOLD = 0.4;

export function alignmentRaceKey(raceId: string | null | undefined): string {
  if (raceId === "half-elf") return "halfelf";
  if (raceId === "half-orc") return "halforc";
  return raceId || "";
}

/**
 * Base alignment questions for a race: apply skips/overrides, then extras.
 * Mirrors the creation wizard (not just extras-only).
 */
export function alignmentQuestionsFor(
  raceId: string | null | undefined,
): AlignmentQuestion[] {
  const key = alignmentRaceKey(raceId);
  const skips = RACE_SKIPS[key] || RACE_SKIPS[raceId || ""] || [];
  const overrides = RACE_OVERRIDES[key] || RACE_OVERRIDES[raceId || ""] || {};
  const extras = RACE_EXTRAS[key] || RACE_EXTRAS[raceId || ""] || [];
  const base = BASE_QUESTIONS.filter((q) => !skips.includes(q.id)).map((q) =>
    overrides[q.id] ? { ...q, ...overrides[q.id] } : q,
  );
  return base.concat(extras);
}

function bracket(ratio: number): number {
  if (ratio >= AXIS_THRESHOLD) return 1;
  if (ratio <= -AXIS_THRESHOLD) return -1;
  return 0;
}

/** Score childhood-quiz answers into a nine-alignment cell. */
export function resolveAlignmentFromQuiz(
  raceId: string | null | undefined,
  answers: readonly AlignQuizAnswer[],
): ResolvedAlignment {
  const questions = alignmentQuestionsFor(raceId);
  const bias = RACE_AXIS_BIAS[raceId || ""] || { law: 0, good: 0 };

  let lawSum = bias.law ?? 0;
  let goodSum = bias.good ?? 0;
  let lawMax = 0;
  let goodMax = 0;

  answers.forEach((ans, i) => {
    if (!ans) return;
    const q = questions[i];
    if (!q) return;
    const opt = q.options.find((o) => o.id === ans.optionId);
    if (!opt) return;
    lawSum += opt.law;
    goodSum += opt.good;
    lawMax += Math.max(...q.options.map((o) => Math.abs(o.law)));
    goodMax += Math.max(...q.options.map((o) => Math.abs(o.good)));
  });

  const lawRatio = lawMax ? lawSum / lawMax : 0;
  const goodRatio = goodMax ? goodSum / goodMax : 0;
  const law = bracket(lawRatio);
  const good = bracket(goodRatio);
  const cell = ALIGNMENTS.find((a) => a.law === law && a.good === good);
  return {
    law,
    good,
    lawSum,
    goodSum,
    lawRatio,
    goodRatio,
    alignmentId: cell?.id ?? "n",
  };
}

/**
 * Quiz-path defining experience: the answered option with the largest
 * |law|+|good|. Distinct from pickDefiningExperienceForAlignment (±2 pool).
 */
export function definingExperienceFromQuiz(
  raceId: string | null | undefined,
  answers: readonly AlignQuizAnswer[],
): DefiningExperience | null {
  const questions = alignmentQuestionsFor(raceId);
  let best: DefiningExperience | null = null;
  let bestWeight = -1;
  answers.forEach((ans, i) => {
    if (!ans) return;
    const q = questions[i];
    if (!q) return;
    const opt = q.options.find((o) => o.id === ans.optionId);
    if (!opt) return;
    const weight = Math.abs(opt.law) + Math.abs(opt.good);
    if (weight > bestWeight) {
      bestWeight = weight;
      best = {
        questionId: q.id,
        scenario: q.text,
        optionId: opt.id,
        label: opt.label,
      };
    }
  });
  return best;
}

export function alignmentAxes(
  alignmentId: string,
): { ethics: number; morality: number } | null {
  const row = ALIGNMENTS.find((a) => a.id === alignmentId);
  if (!row) return null;
  return { ethics: row.law ?? 0, morality: row.good ?? 0 };
}

/**
 * Candidates when the player picks an alignment directly (no childhood quiz).
 * Ethics (e) = law, morality (m) = good.
 * For each non-neutral axis, include every option that scores ±2 in that
 * direction (option[axis] === axisValue * 2).
 */
export function definingExperienceCandidates(
  alignmentId: string,
  raceId?: string | null,
): DefiningExperience[] {
  const axes = alignmentAxes(alignmentId);
  if (!axes) return [];
  const { ethics: e, morality: m } = axes;
  if (e === 0 && m === 0) return [];

  const out: DefiningExperience[] = [];
  for (const q of alignmentQuestionsFor(raceId)) {
    for (const o of q.options) {
      const matchEthics = e !== 0 && o.law === e * 2;
      const matchMorality = m !== 0 && o.good === m * 2;
      if (!matchEthics && !matchMorality) continue;
      out.push({
        questionId: q.id,
        scenario: q.text,
        optionId: o.id,
        label: o.label,
      });
    }
  }
  return out;
}

/**
 * Pick a defining experience for a directly chosen alignment.
 * Quiz answers use a different rule (strongest answered option) — do not call
 * this after the childhood quiz.
 */
export function pickDefiningExperienceForAlignment(
  alignmentId: string,
  raceId?: string | null,
  rng: () => number = Math.random,
): DefiningExperience | null {
  const candidates = definingExperienceCandidates(alignmentId, raceId);
  if (candidates.length === 0) return null;
  const idx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(rng() * candidates.length)),
  );
  return candidates[idx]!;
}
