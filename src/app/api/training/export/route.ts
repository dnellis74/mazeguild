import { getCatalog } from "@/training/catalog";
import { migrateCharacter, validateCharacter } from "@/training/character";
import { trainingToSrd } from "@/training/toSrd";
import { characterLabel } from "@/campaign/labels";

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

  const { character: raw } = body as { character?: unknown };
  try {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, raw);
    const err = validateCharacter(character);
    if (err) {
      return Response.json({ error: err }, { status: 400 });
    }
    const srd = trainingToSrd(catalog, character);
    console.log(
      JSON.stringify({
        msg: "training_export",
        label: characterLabel(srd),
        class: srd.class,
        race: srd.race,
        features: character.features.length,
      }),
    );
    return Response.json({
      character: srd,
      label: characterLabel(srd),
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: "training_export_error", err: String(err) }));
    return Response.json({ error: "Failed to export character" }, { status: 500 });
  }
}
