import { getCatalog } from "@/training/catalog";
import { defaultTrainingUi, migrateCharacter, validateCharacter } from "@/training/character";
import { buildTrainingView } from "@/training/view";
import type { TrainingUi } from "@/training/types";

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

  const { character: rawCharacter, ui: rawUi } = body as {
    character?: unknown;
    ui?: Partial<TrainingUi>;
  };

  try {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, rawCharacter);
    const err = validateCharacter(character);
    if (err) {
      return Response.json({ error: err, redirect: "/" }, { status: 400 });
    }
    const ui: TrainingUi = { ...defaultTrainingUi(), ...(rawUi || {}) };
    const view = buildTrainingView(catalog, character, ui);
    return Response.json({ character, ui, view });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/missing id|missing name/i.test(message)) {
      return Response.json({ error: message, redirect: "/" }, { status: 400 });
    }
    console.error(JSON.stringify({ msg: "training_view_error", err: message }));
    return Response.json({ error: "Failed to build view" }, { status: 500 });
  }
}
