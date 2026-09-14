import { describe, expect, it } from "vitest";
import { getCatalog, skillById } from "./catalog";
import { CLASS_ARCHETYPES } from "./archetypeFeatures";
import {
  generateCharacter,
  isGenerateError,
  orderSkillsForEarn,
  resolveSkillRef,
} from "./generate";

function seqRng(values: number[]) {
  let i = 0;
  return () => (i < values.length ? values[i++]! : 0.5);
}

/** Full skill/cantrip/spell catalog for tests that cover inactive archetypes. */
function fullCatalog() {
  return getCatalog({
    archetypes: CLASS_ARCHETYPES,
    spellStatuses: ["implemented", "placeholder", "deferred"],
  });
}

describe("resolveSkillRef", () => {
  it("resolves by id and by feature name", () => {
    const catalog = fullCatalog();
    expect(resolveSkillRef(catalog, "f_01r8k4")?.feature).toBe("Rage");
    expect(resolveSkillRef(catalog, "Rage")?.id).toBe("f_01r8k4");
    expect(resolveSkillRef(catalog, "nope")).toBeNull();
  });
});

describe("orderSkillsForEarn", () => {
  it("puts the prerequisite first", () => {
    const catalog = fullCatalog();
    const cantrips = skillById(catalog, "f_03x5n2")!;
    const casting = skillById(catalog, "f_04p6t8")!;
    expect(orderSkillsForEarn(casting, cantrips)?.map((s) => s.id)).toEqual([
      "f_03x5n2",
      "f_04p6t8",
    ]);
  });
});

describe("generateCharacter", () => {
  it("builds a barbarian with gear and ability scores", () => {
    const catalog = fullCatalog();
    const ch = generateCharacter(catalog, {
      id: "c1",
      name: "Grok",
      raceId: "halforc",
      alignmentId: "cn",
      features: ["f_01r8k4", "f_02m7q9"],
      rng: seqRng([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
    });
    expect(isGenerateError(ch)).toBe(false);
    if (isGenerateError(ch)) return;
    expect(ch.featurePoints).toBe(0);
    expect(ch.features).toHaveLength(2);
    expect(ch.abilityScoresAssigned).toBe(true);
    expect(ch.equipment?.mainHand).toBeTruthy();
    expect(ch.cantrips).toEqual([]);
  });

  it("resolves unique feature names (Rage)", () => {
    const catalog = fullCatalog();
    const ch = generateCharacter(catalog, {
      id: "c1b",
      name: "Grok",
      raceId: "halforc",
      alignmentId: "cn",
      features: ["Rage", "f_02m7q9"],
      rng: () => 0.5,
    });
    expect(isGenerateError(ch)).toBe(false);
  });

  it("accepts skill ids and fills magic for a bard path", () => {
    const catalog = fullCatalog();
    const ch = generateCharacter(catalog, {
      id: "c2",
      name: "Lyra",
      raceId: "halfelf",
      alignmentId: "cg",
      // Spellcasting first — should reorder so cantrips earn first.
      features: ["f_04p6t8", "f_03x5n2"],
      rng: () => 0,
    });
    expect(isGenerateError(ch)).toBe(false);
    if (isGenerateError(ch)) return;
    expect(ch.features.map((f) => f.id)).toEqual(["f_03x5n2", "f_04p6t8"]);
    expect(ch.cantrips.length).toBeGreaterThan(0);
    expect(ch.spells.length).toBeGreaterThan(0);
  });

  it("rejects unknown race and unmet prerequisites", () => {
    const catalog = fullCatalog();
    expect(
      generateCharacter(catalog, {
        id: "x",
        name: "X",
        raceId: "lizardfolk",
        alignmentId: "lg",
        features: ["Rage", "Unarmored Defense"],
      }),
    ).toEqual({ error: "Unknown raceId: lizardfolk" });

    // Divine Spellcasting without Divine Cantrips
    const bad = generateCharacter(catalog, {
      id: "x",
      name: "X",
      raceId: "human",
      alignmentId: "lg",
      features: ["f_06q9m3", "Rage"],
    });
    expect(isGenerateError(bad)).toBe(true);
    if (isGenerateError(bad)) {
      expect(bad.error).toMatch(/Prerequisite/);
    }
  });

  it("builds from archetype name (e.g. cleric)", () => {
    const catalog = getCatalog();
    const ch = generateCharacter(catalog, {
      id: "clr",
      name: "Mira",
      raceId: "human",
      alignmentId: "lg",
      archetype: "cleric",
      rng: () => 0,
    });
    expect(isGenerateError(ch)).toBe(false);
    if (isGenerateError(ch)) return;
    expect(ch.features.map((f) => f.id)).toEqual(["f_05k2v7", "f_06q9m3"]);
    expect(ch.cantrips.length).toBe(3);
    expect(ch.spells.length).toBeGreaterThan(0);
  });
});
