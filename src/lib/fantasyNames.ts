import { Names } from "fantasy-content-generator";
import type { IRace } from "fantasy-content-generator/dist/interfaces";

/** Our race ids → fantasy-content-generator race keys. */
const RACE_TO_FCG: Record<string, IRace> = {
  dwarf: "dwarf",
  elf: "elf",
  halfling: "halfling",
  human: "human",
  dragonborn: "dragonborn",
  gnome: "gnome",
  halfelf: "halfElf",
  "half-elf": "halfElf",
  halfElf: "halfElf",
  halforc: "halfOrc",
  "half-orc": "halfOrc",
  halfOrc: "halfOrc",
  tiefling: "tiefling",
};

export type FantasyGender = "male" | "female";

export type FantasyNameResult = {
  name: string;
  gender: FantasyGender;
  race: string;
  seed: string;
};

export function fcgRaceKey(raceId: string | null | undefined): IRace {
  if (!raceId) return "human";
  return RACE_TO_FCG[raceId] || RACE_TO_FCG[raceId.toLowerCase()] || "human";
}

export function randomGender(rng: () => number = Math.random): FantasyGender {
  return rng() < 0.5 ? "male" : "female";
}

/**
 * Race-appropriate PHB-style name via fantasy-content-generator.
 * Gender defaults to a random pick.
 */
export function generateFantasyName(
  raceId: string | null | undefined,
  opts?: { gender?: FantasyGender; seed?: string; rng?: () => number },
): FantasyNameResult {
  const gender = opts?.gender ?? randomGender(opts?.rng);
  const race = fcgRaceKey(raceId);
  const generated = Names.generate({
    race,
    gender,
    ...(opts?.seed ? { seed: opts.seed } : {}),
  });

  const name = (
    generated.formattedData?.name ||
    generated.name ||
    "Stranger"
  ).trim();

  return {
    name: name || "Stranger",
    gender: generated.gender === "female" ? "female" : "male",
    race: generated.race || race,
    seed: String(generated.seed || opts?.seed || ""),
  };
}

/** Prefer a name not already on the roster; a few retries then accept. */
export function generateUniqueFantasyName(
  raceId: string | null | undefined,
  taken: Iterable<string>,
  opts?: { gender?: FantasyGender; rng?: () => number; attempts?: number },
): FantasyNameResult {
  const takenSet = new Set(
    [...taken].map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  const attempts = opts?.attempts ?? 12;
  let last = generateFantasyName(raceId, opts);
  for (let i = 0; i < attempts; i++) {
    last = generateFantasyName(raceId, {
      gender: opts?.gender ?? randomGender(opts?.rng),
      rng: opts?.rng,
    });
    if (!takenSet.has(last.name.toLowerCase())) return last;
  }
  return last;
}
