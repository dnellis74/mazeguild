import { generateParty } from "@/gen/generate";
import { parsePartyInput } from "@/gen/params";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePartyInput(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const party = generateParty(parsed.value);
  console.log(
    JSON.stringify({
      msg: "party_generate",
      seed: parsed.value.seed,
      partySeed: parsed.value.partySeed,
      count: party.length,
      balanced: parsed.value.balanced,
      names: parsed.value.names,
      classes: party.map((p) => p.class),
    }),
  );
  return Response.json({
    seed: parsed.value.seed,
    partySeed: parsed.value.partySeed,
    party,
  });
}
