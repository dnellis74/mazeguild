import { describe, expect, it } from "vitest";
import { getCatalog } from "@/training/catalog";
import {
  characterLabel,
  createEmptyCompanion,
  raceDisplayName,
} from "@/training/companion";

describe("createEmptyCompanion", () => {
  it("builds a clean companion with identity and defaults", () => {
    const catalog = getCatalog();
    const ch = createEmptyCompanion(catalog, {
      id: "c1",
      name: "Aldric",
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    expect(ch.id).toBe("c1");
    expect(ch.name).toBe("Aldric");
    expect(ch.featurePoints).toBe(2);
    expect(ch.features).toEqual([]);
    expect(ch.abilityScoresAssigned).toBe(false);
    expect(ch.xp).toBe(0);
    expect(ch.hp).toBeNull();
    expect(ch.unlocked.areas["Walled City"]).toBe(true);
  });
});

describe("characterLabel", () => {
  it("prefers name", () => {
    const catalog = getCatalog();
    const ch = createEmptyCompanion(catalog, {
      id: "c1",
      name: "  Aldric  ",
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    expect(characterLabel(ch)).toBe("Aldric");
  });

  it("falls back when name is blank", () => {
    expect(characterLabel({ name: "", raceId: "elf" } as never)).toBe(
      "elf companion",
    );
  });
});

describe("raceDisplayName", () => {
  it("uses catalog names", () => {
    const catalog = getCatalog();
    expect(raceDisplayName(catalog, "human")).toBe("Human");
  });
});
