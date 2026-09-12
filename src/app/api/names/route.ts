import {
  generateUniqueFantasyName,
  type FantasyGender,
} from "@/lib/fantasyNames";

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

  const { raceId, gender, taken } = body as {
    raceId?: string;
    gender?: FantasyGender;
    taken?: string[];
  };

  if (!raceId || typeof raceId !== "string") {
    return Response.json({ error: "raceId required" }, { status: 400 });
  }

  const g =
    gender === "male" || gender === "female" ? gender : undefined;
  const takenList = Array.isArray(taken)
    ? taken.filter((n): n is string => typeof n === "string")
    : [];

  const result = generateUniqueFantasyName(raceId, takenList, { gender: g });
  return Response.json(result);
}
