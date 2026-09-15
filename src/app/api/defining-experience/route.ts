import {
  alignmentAxes,
  pickDefiningExperienceForAlignment,
} from "@/training/definingExperience";

/**
 * Pick a defining experience for a directly chosen alignment (no childhood quiz).
 * Body: { alignmentId, raceId? }
 * Returns { definingExperience } — null when both axes are neutral (True Neutral).
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

  const { alignmentId, raceId } = body as {
    alignmentId?: unknown;
    raceId?: unknown;
  };

  if (typeof alignmentId !== "string" || !alignmentId) {
    return Response.json({ error: "alignmentId required" }, { status: 400 });
  }
  if (!alignmentAxes(alignmentId)) {
    return Response.json(
      { error: `Unknown alignmentId: ${alignmentId}` },
      { status: 400 },
    );
  }

  const race =
    typeof raceId === "string" && raceId ? raceId : null;

  try {
    const definingExperience = pickDefiningExperienceForAlignment(
      alignmentId,
      race,
    );
    return Response.json({ definingExperience });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "defining_experience_error",
        alignmentId,
        raceId: race,
        err: String(err),
      }),
    );
    return Response.json(
      { error: "Failed to pick defining experience" },
      { status: 500 },
    );
  }
}
