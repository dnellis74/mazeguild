import { describe, expect, it } from "vitest";
import { getCatalog } from "@/training/catalog";
import { migrateCharacter, defaultTrainingUi } from "@/training/character";
import { applyTrainingAction } from "@/training/actions";
import { buildTrainingView } from "@/training/view";

describe("training API domain", () => {
  it("builds a sheet view for a minimal character", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, {
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    const ui = defaultTrainingUi();
    const view = buildTrainingView(catalog, character, ui);
    expect(view.sheet).toBeTruthy();
    expect(view.sheet?.abilities).toHaveLength(6);
    expect(view.sheet?.abilities[0]?.score).toBe(
      catalog.abilityMods.pointBuy.startingScore,
    );
  });

  it("unlocks an area via complete-job", () => {
    const catalog = getCatalog();
    let character = migrateCharacter(catalog, {
      raceId: "elf",
      alignment: { alignmentId: "ng" },
    });
    let ui = defaultTrainingUi();
    ui.hubTab = "world";

    let result = applyTrainingAction(catalog, character, ui, {
      type: "world-select-area",
      area: "The Wilds",
    });
    expect(result.character.activeJob?.kind).toBe("area");

    // Force job completion
    character = {
      ...result.character,
      activeJob: {
        ...result.character.activeJob!,
        startedAt: Date.now() - 60_000,
      },
    };
    result = applyTrainingAction(catalog, character, result.ui, { type: "complete-job" });
    expect(result.character.unlocked.areas["The Wilds"]).toBe(true);
    expect(result.ui.worldView).toBe("buildings");
  });
});
