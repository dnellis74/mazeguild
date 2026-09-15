import alignmentQuestions from "../../public/data/alignment-questions.json";
import raceAlignment from "../../public/data/race-alignment.json";
import alignments from "../../public/data/alignments.json";
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

type AlignmentAxes = { id: string; law: number; good: number };

const ALIGNMENTS = alignments as AlignmentAxes[];
const BASE_QUESTIONS = alignmentQuestions as AlignmentQuestion[];
const RACE_EXTRAS = (raceAlignment as { extras?: Record<string, AlignmentQuestion[]> })
  .extras ?? {};

function raceKey(raceId: string | null | undefined): string {
  if (raceId === "half-elf") return "halfelf";
  if (raceId === "half-orc") return "halforc";
  return raceId || "";
}

/** Base alignment questions plus any race-specific extras. */
export function alignmentQuestionsFor(
  raceId: string | null | undefined,
): AlignmentQuestion[] {
  const key = raceKey(raceId);
  const extras = RACE_EXTRAS[key] || RACE_EXTRAS[raceId || ""] || [];
  return BASE_QUESTIONS.concat(extras);
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
