import {
  ALIGNMENTS,
  CLASS_NAMES,
  PARTY_CAP,
  RACE_NAMES,
  TAVERN_CAP,
  RACES,
} from "./data";

/** Request body for POST /api/party — the questions from the port plan. */
export type PartyGenInput = {
  seed: number;
  /** Independent seed for the party. Defaults to `seed` (same as the maze). */
  partySeed?: number;
  /** How many to generate. Defaults to party size (4), max 12 (tavern hall). */
  count?: number;
  /** At least one tank and one healer when count >= 2. Defaults to true. */
  balanced?: boolean;
  /** Assign unique given names. Defaults to true. */
  names?: boolean;
  class?: string;
  race?: string;
  subrace?: string;
  alignment?: string;
};

export type PartyGenOptions = {
  seed: number;
  partySeed: number;
  count: number;
  balanced: boolean;
  names: boolean;
  class?: string;
  race?: string;
  subrace?: string;
  alignment?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parsePartyInput(
  body: unknown,
): { ok: true; value: PartyGenOptions } | { ok: false; error: string } {
  if (!isRecord(body)) {
    return { ok: false, error: "Expected an object" };
  }

  const { seed } = body;
  if (typeof seed !== "number" || !Number.isFinite(seed)) {
    return { ok: false, error: "seed must be a number" };
  }

  let partySeed = seed;
  if (body.partySeed !== undefined) {
    if (typeof body.partySeed !== "number" || !Number.isFinite(body.partySeed)) {
      return { ok: false, error: "partySeed must be a number" };
    }
    partySeed = body.partySeed;
  }

  let count = PARTY_CAP;
  if (body.count !== undefined) {
    if (
      typeof body.count !== "number" ||
      !Number.isInteger(body.count) ||
      body.count < 1
    ) {
      return { ok: false, error: "count must be an integer >= 1" };
    }
    count = Math.min(body.count, TAVERN_CAP);
  }

  let balanced = true;
  if (body.balanced !== undefined) {
    if (typeof body.balanced !== "boolean") {
      return { ok: false, error: "balanced must be a boolean" };
    }
    balanced = body.balanced;
  }

  let names = true;
  if (body.names !== undefined) {
    if (typeof body.names !== "boolean") {
      return { ok: false, error: "names must be a boolean" };
    }
    names = body.names;
  }

  let className: string | undefined;
  if (body.class !== undefined) {
    if (typeof body.class !== "string" || !CLASS_NAMES.includes(body.class)) {
      return { ok: false, error: `class must be one of: ${CLASS_NAMES.join(", ")}` };
    }
    className = body.class;
  }

  let race: string | undefined;
  if (body.race !== undefined) {
    if (typeof body.race !== "string" || !RACE_NAMES.includes(body.race)) {
      return { ok: false, error: `race must be one of: ${RACE_NAMES.join(", ")}` };
    }
    race = body.race;
  }

  let subrace: string | undefined;
  if (body.subrace !== undefined) {
    if (typeof body.subrace !== "string") {
      return { ok: false, error: "subrace must be a string" };
    }
    if (!race) {
      return { ok: false, error: "subrace requires race" };
    }
    const options = Object.keys(RACES[race]!.subraces);
    if (!options.includes(body.subrace)) {
      return {
        ok: false,
        error: options.length
          ? `subrace must be one of: ${options.join(", ")}`
          : `${race} has no SRD subraces`,
      };
    }
    subrace = body.subrace;
  }

  let alignment: string | undefined;
  if (body.alignment !== undefined) {
    if (
      typeof body.alignment !== "string" ||
      !ALIGNMENTS.includes(body.alignment)
    ) {
      return {
        ok: false,
        error: `alignment must be one of: ${ALIGNMENTS.join(", ")}`,
      };
    }
    alignment = body.alignment;
  }

  return {
    ok: true,
    value: {
      seed: Math.floor(seed),
      partySeed: Math.floor(partySeed),
      count,
      balanced,
      names,
      class: className,
      race,
      subrace,
      alignment,
    },
  };
}
