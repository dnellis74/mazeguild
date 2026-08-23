import { NextRequest } from "next/server";
import { runDungeon } from "@/sim/run";
import type { SrdCharacter } from "@/sim/types";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Expected an object" }, { status: 400 });
  }

  const { seed, party } = body as { seed?: unknown; party?: unknown };

  if (typeof seed !== "number" || !Number.isFinite(seed)) {
    return Response.json({ error: "seed must be a number" }, { status: 400 });
  }
  if (!Array.isArray(party) || party.length < 1) {
    return Response.json(
      { error: "party must be a non-empty array of SRD characters" },
      { status: 400 },
    );
  }

  const result = runDungeon({
    seed: Math.floor(seed),
    party: party as SrdCharacter[],
  });
  console.log(
    JSON.stringify({
      msg: "dungeon_run",
      seed: result.seed,
      score: result.score,
      stepsTaken: result.stepsTaken,
      events: result.log.length,
    }),
  );
  return Response.json(result);
}
