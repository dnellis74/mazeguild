import { describe, expect, it } from "vitest";
import cantripData from "../../public/data/cantrips.json";
import spellDataL1 from "../../public/data/spells_level1.json";
import spellDataL2 from "../../public/data/spells_level2.json";
import { getCatalog } from "./catalog";
import { cantripsForArchetype, spellsForArchetype } from "./magic";
import {
  assertSpellEffectAllowed,
  DEV_SHOW_PLACEHOLDERS,
  getStatus,
  SPELL_STATUS,
  withSpellStatusOverrides,
} from "./spellStatus";
import { resolveAutoSpell } from "@/sim/rules";
import { getSpell } from "@/sim/spells";
import { createRng } from "@/sim/rng";

const SHORTLIST_CANTRIPS = [
  "Sacred Flame",
  "Guidance",
  "Light",
  "Spare the Dying",
  "Thaumaturgy",
  "Fire Bolt",
  "Shocking Grasp",
  "Chill Touch",
  "Mage Hand",
  "Minor Illusion",
] as const;

const SHORTLIST_SPELLS = [
  "Bless",
  "Cure Wounds",
  "Guiding Bolt",
  "Healing Word",
  "Inflict Wounds",
  "Shield of Faith",
  "Command",
  "Detect Magic",
  "Lesser Restoration",
  "Spiritual Weapon",
  "Hold Person",
  "Aid",
  "Prayer of Healing",
  "Magic Missile",
  "Shield",
  "Mage Armor",
  "Burning Hands",
  "Thunderwave",
  "Sleep",
  "Comprehend Languages",
  "Scorching Ray",
  "Mirror Image",
  "Invisibility",
  "Knock",
] as const;

describe("milestone 2 spell status", () => {
  it("resolves every shortlist name to a real JSON row", () => {
    const cantripNames = new Set(
      (cantripData as { cantrips: { name: string }[] }).cantrips.map(
        (c) => c.name,
      ),
    );
    const spellNames = new Set([
      ...(spellDataL1 as { spells: { name: string }[] }).spells.map(
        (s) => s.name,
      ),
      ...(spellDataL2 as { spells: { name: string }[] }).spells.map(
        (s) => s.name,
      ),
    ]);
    for (const name of SHORTLIST_CANTRIPS) {
      expect(cantripNames.has(name), `missing cantrip ${name}`).toBe(true);
    }
    for (const name of SHORTLIST_SPELLS) {
      expect(spellNames.has(name), `missing spell ${name}`).toBe(true);
    }
  });

  it("excludes placeholder and deferred from offer lists when DEV_SHOW_PLACEHOLDERS is false", () => {
    expect(DEV_SHOW_PLACEHOLDERS).toBe(false);
    const catalog = getCatalog();
    const offered = [
      ...cantripsForArchetype(catalog, "Cleric"),
      ...cantripsForArchetype(catalog, "Wizard"),
      ...spellsForArchetype(catalog, "Cleric"),
      ...spellsForArchetype(catalog, "Wizard"),
    ];
    for (const row of offered) {
      expect(getStatus(row.name)).toBe("implemented");
    }
    expect(offered.some((r) => r.name === "Sacred Flame")).toBe(false);
    expect(offered.some((r) => r.name === "Ray of Frost")).toBe(false);
    expect(offered.some((r) => r.name === "Mage Armor")).toBe(false);
  });

  it("throws in development when a placeholder spell reaches the resolver", () => {
    expect(getStatus("Mage Armor")).toBe("placeholder");
    // Use Magic Missile's resolver with a placeholder name via status override
    // so we exercise assertSpellEffectAllowed without a real Mage Armor effect.
    withSpellStatusOverrides({ "Magic Missile": "placeholder" }, () => {
      const spell = getSpell("Magic Missile")!;
      expect(() => resolveAutoSpell(createRng(1), spell)).toThrow(
        /placeholder/,
      );
    });
  });

  it("counts match the shortlist registry", () => {
    const implemented = Object.values(SPELL_STATUS).filter(
      (s) => s === "implemented",
    ).length;
    const placeholder = Object.values(SPELL_STATUS).filter(
      (s) => s === "placeholder",
    ).length;
    expect(implemented).toBe(14);
    expect(placeholder).toBe(20);
    expect(assertSpellEffectAllowed).toBeTypeOf("function");
  });
});
