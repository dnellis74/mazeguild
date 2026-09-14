import { describe, expect, it } from "vitest";
import {
  ARCHETYPE_STARTER_FEATURES,
  CLASS_ARCHETYPES,
  featuresForArchetype,
  resolveArchetype,
} from "./archetypeFeatures";
import { getCatalog, skillById } from "./catalog";

describe("archetype starter features", () => {
  it("covers every SRD class with two distinct catalog skills", () => {
    const catalog = getCatalog();
    expect(CLASS_ARCHETYPES).toContain("Cleric");
    for (const arch of CLASS_ARCHETYPES) {
      const [a, b] = ARCHETYPE_STARTER_FEATURES[arch];
      expect(a).not.toBe(b);
      const skillA = skillById(catalog, a);
      const skillB = skillById(catalog, b);
      expect(skillA?.archetype).toBe(arch);
      expect(skillB?.archetype).toBe(arch);
    }
  });

  it("resolves case-insensitive archetype names", () => {
    expect(resolveArchetype("cleric")).toBe("Cleric");
    expect(featuresForArchetype("CLERIC")).toEqual(
      ARCHETYPE_STARTER_FEATURES.Cleric,
    );
    expect(featuresForArchetype("pirate")).toBeNull();
  });
});
