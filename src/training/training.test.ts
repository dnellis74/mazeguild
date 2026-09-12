import { describe, expect, it } from "vitest";
import { getCatalog } from "@/training/catalog";
import { migrateCharacter, defaultTrainingUi } from "@/training/character";
import { applyTrainingAction } from "@/training/actions";
import { buildTrainingView } from "@/training/view";
import { companionToCombatant } from "@/sim/adapter";
import { buildWorld } from "@/training/world";
import {
  TOWN_SQUARE_AREA,
  TOWN_SQUARE_BUILDING,
} from "@/training/townSquare";

function baseCompanion(over: Record<string, unknown> = {}) {
  return {
    id: "c-test",
    name: "Test",
    raceId: "human",
    alignment: { alignmentId: "lg" },
    ...over,
  };
}

describe("training API domain", () => {
  it("builds a sheet view for a minimal character", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, baseCompanion());
    const ui = { ...defaultTrainingUi(), hubTab: "sheet" as const };
    const view = buildTrainingView(catalog, character, ui);
    expect(view.sheet).toBeTruthy();
    expect(view.sheet?.abilities).toHaveLength(6);
    expect(view.sheet?.abilities[0]?.score).toBe(
      catalog.abilityMods.pointBuy.startingScore,
    );
  });

  it("lists Town Square beside Tavern in the Walled City", () => {
    const catalog = getCatalog();
    const walled = buildWorld(catalog).find((a) => a.name === TOWN_SQUARE_AREA);
    const names = walled?.buildings.map((b) => b.name) ?? [];
    expect(names).toContain(TOWN_SQUARE_BUILDING);
    expect(names).toContain("Tavern");
    expect(names.indexOf(TOWN_SQUARE_BUILDING)).toBeLessThan(names.indexOf("Tavern"));
  });

  it("sends Town Square selection to the character roster hub", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, baseCompanion());
    expect(character.unlocked.buildings[`${TOWN_SQUARE_AREA}::${TOWN_SQUARE_BUILDING}`]).toBe(
      true,
    );

    let ui: ReturnType<typeof defaultTrainingUi> = {
      ...defaultTrainingUi(),
      hubTab: "world",
    };
    let result = applyTrainingAction(catalog, character, ui, {
      type: "world-select-area",
      area: TOWN_SQUARE_AREA,
    });
    expect(result.ui.worldView).toBe("buildings");

    result = applyTrainingAction(catalog, result.character, result.ui, {
      type: "world-select-building",
      building: TOWN_SQUARE_BUILDING,
    });
    expect(result.navigate).toBe("/");
  });

  it("unlocks an area via complete-job", () => {
    const catalog = getCatalog();
    let character = migrateCharacter(
      catalog,
      baseCompanion({ id: "c-elf", name: "Elowen", raceId: "elf", alignment: { alignmentId: "ng" } }),
    );
    let ui = defaultTrainingUi();
    ui.hubTab = "world";

    let result = applyTrainingAction(catalog, character, ui, {
      type: "world-select-area",
      area: "The Wilds",
    });
    expect(result.character.activeJob?.kind).toBe("area");

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

  it("maps a trained companion into a combatant from features", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(
      catalog,
      baseCompanion({
        id: "c-fighter",
        name: "Aldric",
        features: [
          {
            id: "fighter-fighting-style",
            archetype: "Fighter",
            feature: ["Defense"],
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
      }),
    );
    const combatant = companionToCombatant(character, 0);
    expect(combatant.archetype).toBe("Fighter");
    expect(combatant.race).toBe("Human");
    expect(combatant.name).toBe("Aldric");
    expect(combatant.maxHp).toBeGreaterThan(0);
    expect(combatant.abilities.STR).toBe(15);
  });

  it("rejects companions without identity", () => {
    const catalog = getCatalog();
    expect(() =>
      migrateCharacter(catalog, { raceId: "human", alignment: { alignmentId: "lg" } }),
    ).toThrow(/missing id/i);
  });

  it("switches the hub tab to quest without a quest view DTO", () => {
    const catalog = getCatalog();
    const character = migrateCharacter(catalog, baseCompanion());
    const ui = { ...defaultTrainingUi(), hubTab: "quest" as const };
    const view = buildTrainingView(catalog, character, ui);
    expect(view.tab).toBe("quest");
    expect(view.sheet).toBeNull();
    expect(view.world).toBeNull();
  });
});
