import { getCatalog } from "@/training/catalog";
import { createEmptyCompanion } from "@/training/companion";
import { generateUniqueFantasyName } from "@/lib/fantasyNames";
import type { Character } from "@/training/types";

/**
 * Build a fresh companion for intake.
 * Body: { raceId, alignmentId, name?, subrace?, definingExperience?, taken? }
 * Returns { companion } — client appends to mazeguild.roster.
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
    name: rawName,
    subrace,
    definingExperience,
    taken,
  } = body as {
    raceId?: unknown;
    alignmentId?: unknown;
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
    const companion = createEmptyCompanion(catalog, {
      id,
      name,
      raceId,
      subrace: subrace ?? null,
      alignment: {
        alignmentId,
        definingExperience: definingExperience ?? null,
      },
    });
    return Response.json({ companion });
  } catch (err) {
    console.error(JSON.stringify({ msg: "companion_create_error", err: String(err) }));
    return Response.json({ error: "Failed to create companion" }, { status: 500 });
  }
}
