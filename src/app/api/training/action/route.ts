import { applyTrainingAction } from "@/training/actions";
import { getCatalog } from "@/training/catalog";
import { defaultTrainingUi, migrateCharacter, validateCharacter } from "@/training/character";
import { buildTrainingView } from "@/training/view";
import type { TrainingAction, TrainingUi } from "@/training/types";

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

  const { character: rawCharacter, ui: rawUi, action } = body as {
    character?: unknown;
    ui?: Partial<TrainingUi>;
    action?: TrainingAction;
  };

  if (!action || typeof action !== "object" || !("type" in action)) {
    return Response.json({ error: "action required" }, { status: 400 });
  }

  try {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, rawCharacter);
    const err = validateCharacter(character);
    if (err) {
      return Response.json({ error: err, redirect: "/character-initialization.html" }, { status: 400 });
    }
    const ui: TrainingUi = { ...defaultTrainingUi(), ...(rawUi || {}) };
    const result = applyTrainingAction(catalog, character, ui, action);
    const view = buildTrainingView(catalog, result.character, result.ui);

    console.log(
      JSON.stringify({
        msg: "training_action",
        type: action.type,
        raceId: result.character.raceId,
        features: result.character.features.length,
        featurePoints: result.character.featurePoints,
        job: result.character.activeJob?.kind || null,
      }),
    );

    return Response.json({
      character: result.character,
      ui: result.ui,
      view,
      toast: result.toast || null,
      jobRunning: result.jobRunning || !!result.character.activeJob,
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: "training_action_error", err: String(err) }));
    return Response.json({ error: "Failed to apply action" }, { status: 500 });
  }
}
