import { describe, expect, it } from "vitest";
import { characterToCombatant } from "@/sim/adapter";
import { createRng } from "@/sim/rng";
import { HEALER_CLASSES, TANK_CLASSES } from "./data";
import { generateCharacter, generateParty } from "./generate";
import { parsePartyInput } from "./params";

function opts(over: Record<string, unknown> = {}) {
  const parsed = parsePartyInput({ seed: 7, ...over });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

describe("parsePartyInput", () => {
  it("applies the planned defaults", () => {
    const parsed = parsePartyInput({ seed: 99 });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      seed: 99,
      partySeed: 99,
      count: 4,
      balanced: true,
      names: true,
    });
  });

  it("rejects an unknown class", () => {
    const parsed = parsePartyInput({ seed: 1, class: "Artificer" });
    expect(parsed.ok).toBe(false);
  });

  it("allows a tavern-sized count", () => {
    const parsed = parsePartyInput({ seed: 2, count: 12, balanced: false });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.count).toBe(12);
  });
});

describe("generateParty", () => {
  it("is byte-identical for the same partySeed", () => {
    const a = generateParty(opts({ seed: 11 }));
    const b = generateParty(opts({ seed: 11 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("changes when partySeed changes", () => {
    const a = generateParty(opts({ seed: 11, partySeed: 11 }));
    const b = generateParty(opts({ seed: 11, partySeed: 12 }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("includes a tank and a healer when balanced", () => {
    const party = generateParty(opts({ seed: 3, balanced: true }));
    expect(party.some((p) => TANK_CLASSES.includes(p.class as (typeof TANK_CLASSES)[number]))).toBe(
      true,
    );
    expect(
      party.some((p) => HEALER_CLASSES.includes(p.class as (typeof HEALER_CLASSES)[number])),
    ).toBe(true);
    expect(party).toHaveLength(4);
    expect(new Set(party.map((p) => p.name)).size).toBe(4);
  });

  it("honors a forced class even when balanced", () => {
    const party = generateParty(opts({ seed: 4, class: "Wizard", balanced: true }));
    expect(party.every((p) => p.class === "Wizard")).toBe(true);
  });

  it("omits names when names is false", () => {
    const party = generateParty(opts({ seed: 5, names: false }));
    expect(party.every((p) => p.name === undefined)).toBe(true);
  });

  it("assigns legal scores, hp, and ac", () => {
    const ch = generateCharacter(createRng(21), { class: "Cleric", race: "Dwarf" });
    expect(ch.race).toBe("Dwarf");
    expect(ch.subrace).toBe("Hill Dwarf");
    expect(ch.class).toBe("Cleric");
    for (const abi of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) {
      const score = ch.ability_scores[abi]?.score ?? 0;
      expect(score).toBeGreaterThanOrEqual(8);
      expect(score).toBeLessThanOrEqual(20);
    }
    const con = ch.ability_scores.CON!.score;
    const expectedHp = 8 + Math.floor((con - 10) / 2) + 1;
    expect(ch.hit_points.value).toBe(expectedHp);
    expect(ch.armor_class.value).toBeGreaterThanOrEqual(10);
    expect(ch.spellcasting?.ability).toBe("WIS");
  });

  it("can fill a tavern hall", () => {
    const hall = generateParty(opts({ seed: 9, count: 12, balanced: false }));
    expect(hall).toHaveLength(12);
    expect(new Set(hall.map((p) => p.name)).size).toBe(12);
  });

  it("feeds the combat adapter", () => {
    const party = generateParty(opts({ seed: 8 }));
    const combatant = characterToCombatant(party[0]!, 0);
    expect(combatant.maxHp).toBeGreaterThan(0);
    expect(combatant.ac).toBeGreaterThan(0);
    expect(combatant.weapon.name.length).toBeGreaterThan(0);
  });
});
