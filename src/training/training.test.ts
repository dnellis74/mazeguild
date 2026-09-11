import { describe, expect, it } from "vitest";
import { getCatalog } from "@/training/catalog";
import { migrateCharacter, defaultTrainingUi } from "@/training/character";
import { applyTrainingAction } from "@/training/actions";
import { buildTrainingView } from "@/training/view";
import { trainingToSrd } from "@/training/toSrd";

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

  it("exports a trained character to an SRD blob", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, {
      raceId: "human",
      alignment: { alignmentId: "lg" },
      features: [
        {
          skillId: "fighter-fighting-style",
          archetype: "Fighter",
          feature: "Defense",
          area: "Town",
          building: "Drill Yard",
          room: "Yard",
        },
      ],
      abilityScores: {
        STR: 15,
        DEX: 14,
        CON: 13,
        INT: 10,
        WIS: 12,
        CHA: 8,
      },
      abilityScoresAssigned: true,
    });
    const srd = trainingToSrd(catalog, character);
    expect(srd.class).toBe("Fighter");
    expect(srd.race).toBe("Human");
    expect(srd.name).toBe("PLAYER");
    expect(srd.hit_points.value).toBeGreaterThan(0);
    expect(srd.ability_scores.STR.score).toBe(15);
  });

  it("switches the hub tab to quest without a quest view DTO", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, {
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    const ui = { ...defaultTrainingUi(), hubTab: "quest" as const };
    const view = buildTrainingView(catalog, character, ui);
    expect(view.tab).toBe("quest");
    expect(view.sheet).toBeNull();
    expect(view.world).toBeNull();
  });
});
