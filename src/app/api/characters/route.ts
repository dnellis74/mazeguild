import { ACTIVE_ARCHETYPES, getCatalog } from "@/training/catalog";
import {
  featuresForArchetype,
  resolveArchetype,
} from "@/training/archetypeFeatures";
import { generateCharacter, isGenerateError } from "@/training/generate";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";
import type { Character } from "@/training/types";

const OFFERED_ARCHETYPES = [...ACTIVE_ARCHETYPES];

function isOfferedArchetype(name: string): boolean {
  const resolved = resolveArchetype(name);
  return (
    resolved != null &&
    (ACTIVE_ARCHETYPES as readonly string[]).includes(resolved)
  );
}

/**
 * Generate a combat-ready character from race, alignment, and either
 * an archetype (standard two starter features) or an explicit features pair.
 *
 * Body: {
 *   raceId, alignmentId,
 *   archetype?: "Cleric" | "cleric" | ...,
 *   features?: [skillIdOrName, skillIdOrName],
 *   name?, subrace?, definingExperience?, taken?
 * }
 * Returns { character } on success.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Expected an object" }, { status: 400 });
  }

  const {
    raceId,
    alignmentId,
    archetype,
    features,
    name: rawName,
    subrace,
    definingExperience,
    taken,
  } = body as {
    raceId?: unknown;
    alignmentId?: unknown;
    archetype?: unknown;
    features?: unknown;
    name?: unknown;
    subrace?: Character["subrace"];
    definingExperience?: Character["alignment"]["definingExperience"];
    taken?: unknown;
  };

  if (typeof raceId !== "string" || !raceId) {
    return Response.json({ error: "raceId required" }, { status: 400 });
  }
  if (typeof alignmentId !== "string" || !alignmentId) {
    return Response.json({ error: "alignmentId required" }, { status: 400 });
  }

  let featurePair: [string, string] | undefined;
  if (Array.isArray(features)) {
    if (features.length !== 2) {
      return Response.json(
        { error: "features must be an array of exactly two skill ids or names" },
        { status: 400 },
      );
    }
    if (
      typeof features[0] !== "string" ||
      typeof features[1] !== "string" ||
      !features[0] ||
      !features[1]
    ) {
      return Response.json(
        { error: "features must be two non-empty strings" },
        { status: 400 },
      );
    }
    featurePair = [features[0], features[1]];
  } else if (typeof archetype === "string" && archetype.trim()) {
    if (!isOfferedArchetype(archetype)) {
      return Response.json(
        {
          error: `Unknown or inactive archetype: ${archetype}`,
          archetypes: OFFERED_ARCHETYPES,
        },
        { status: 400 },
      );
    }
    const fromArch = featuresForArchetype(archetype);
    if (!fromArch) {
      return Response.json(
        {
          error: `Unknown archetype: ${archetype}`,
          archetypes: OFFERED_ARCHETYPES,
        },
        { status: 400 },
      );
    }
    featurePair = fromArch;
  } else {
    return Response.json(
      {
        error: "archetype or features required",
        archetypes: OFFERED_ARCHETYPES,
      },
      { status: 400 },
    );
  }

  const takenList = Array.isArray(taken)
    ? taken.filter((t): t is string => typeof t === "string")
    : [];

  let name =
    typeof rawName === "string" && rawName.trim() ? rawName.trim() : "";
  if (!name) {
    name = generateUniqueFantasyName(raceId, takenList).name;
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `c-${Date.now()}`;

  try {
    const catalog = getCatalog();
    const result = generateCharacter(catalog, {
      id,
      name,
      raceId,
      alignmentId,
      features: featurePair,
      archetype: typeof archetype === "string" ? archetype : undefined,
      subrace: subrace ?? null,
      definingExperience: definingExperience ?? null,
    });
    if (isGenerateError(result)) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ character: result });
  } catch (err) {
    console.error(
      JSON.stringify({ msg: "character_generate_error", err: String(err) }),
    );
    return Response.json(
      { error: "Failed to generate character" },
      { status: 500 },
    );
  }
}
