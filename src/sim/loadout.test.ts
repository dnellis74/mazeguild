import { describe, expect, it } from "vitest";
import { companionToCombatant } from "./adapter";
import {
  armorFromEquipmentId,
  emptyEquipment,
  isMetalArmorId,
  mergeEquipmentSlots,
  normalizeEquipment,
  resolveDefaultLoadout,
} from "./loadout";
import { getCatalog } from "@/training/catalog";
import { applyTrainingAction } from "@/training/actions";
import { createEmptyCompanion } from "@/training/companion";
import { defaultTrainingUi } from "@/training/character";
import type { Character } from "@/training/types";
import { runDungeon } from "./run";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("isMetalArmorId", () => {
  it("reads material: [\"metal\"] from equipment.json", () => {
    expect(isMetalArmorId("chain_mail")).toBe(true);
    expect(isMetalArmorId("scale_mail")).toBe(true);
    expect(isMetalArmorId("plate")).toBe(true);
    expect(isMetalArmorId("leather")).toBe(false);
    expect(isMetalArmorId("hide")).toBe(false);
    expect(isMetalArmorId("shield")).toBe(false);
    expect(isMetalArmorId(null)).toBe(false);
  });
});

describe("armorFromEquipmentId", () => {
  it("reads AC and strengthRequirement from equipment.json", () => {
    const mail = armorFromEquipmentId("chain_mail");
    expect(mail).toMatchObject({
      name: "Chain mail",
      category: "heavy",
      baseAC: 16,
      dexCap: 0,
      strRequirement: 13,
    });
    expect(armorFromEquipmentId("leather")?.strRequirement).toBeNull();
  });
});

describe("resolveDefaultLoadout", () => {
  it("Fighter: first options — chain mail, martial weapon→longsword+shield, dungeoneer's pack", () => {
    const loadout = resolveDefaultLoadout("Fighter");
    expect(loadout.armor).toBe("chain_mail");
    expect(loadout.mainHand).toBe("longsword");
    expect(loadout.offHand).toBe("shield");
    expect(loadout.pack?.name).toBe("Dungeoneer's Pack");
    expect(loadout.pack?.contents.length).toBeGreaterThan(0);
  });

  it("Ranger: scale mail + two-shortswords bundle fills both hands", () => {
    const loadout = resolveDefaultLoadout("Ranger");
    expect(loadout.armor).toBe("scale_mail");
    expect(loadout.mainHand).toBe("shortsword");
    expect(loadout.offHand).toBe("shortsword");
    expect(loadout.pack?.name).toBe("Dungeoneer's Pack");
  });

  it("Barbarian: greataxe + explorer's pack; named extras append into pack.contents", () => {
    const loadout = resolveDefaultLoadout("Barbarian");
    expect(loadout.mainHand).toBe("greataxe");
    expect(loadout.armor).toBeNull();
    expect(loadout.offHand).toBeNull();
    expect(loadout.pack?.name).toBe("Explorer's Pack");
    expect(loadout.pack?.contents).toEqual(
      expect.arrayContaining(["Two handaxes", "Four javelins"]),
    );
  });

  it("Wizard: quarterstaff + scholar pack; pouch and spellbook both survive in pack.contents", () => {
    const loadout = resolveDefaultLoadout("Wizard");
    expect(loadout.armor).toBeNull();
    expect(loadout.mainHand).toBe("quarterstaff");
    expect(loadout.offHand).toBeNull();
    expect(loadout.pack?.name).toBe("Scholar's Pack");
    // Component pouch arrives before pack in choice order — queued then flushed.
    // Spellbook is a fixed grant after pack — appended. Neither overwrites the other.
    expect(loadout.pack?.contents).toEqual(
      expect.arrayContaining(["Component pouch", "Spellbook"]),
    );
    const pouchIdx = loadout.pack!.contents.indexOf("Component pouch");
    const bookIdx = loadout.pack!.contents.indexOf("Spellbook");
    expect(pouchIdx).toBeGreaterThanOrEqual(0);
    expect(bookIdx).toBeGreaterThanOrEqual(0);
    expect(pouchIdx).not.toBe(bookIdx);
  });

  it("Bard: lute overflow lands in pack.contents alongside diplomat pack gear", () => {
    const loadout = resolveDefaultLoadout("Bard");
    expect(loadout.mainHand).toBe("rapier");
    expect(loadout.armor).toBe("leather");
    expect(loadout.offHand).toBe("dagger");
    expect(loadout.pack?.name).toBe("Diplomat's Pack");
    expect(loadout.pack?.contents).toContain("Lute");
  });
});

describe("mergeEquipmentSlots", () => {
  it("never overwrites filled slots; merges pack contents additively", () => {
    const current = {
      armor: null,
      mainHand: "rapier",
      offHand: null,
      pack: { name: "Custom", contents: ["Kept item"] },
    };
    const incoming = resolveDefaultLoadout("Fighter");
    const merged = mergeEquipmentSlots(current, incoming);
    expect(merged.mainHand).toBe("rapier");
    expect(merged.armor).toBe("chain_mail");
    expect(merged.offHand).toBe("shield");
    expect(merged.pack?.name).toBe("Custom");
    expect(merged.pack?.contents).toContain("Kept item");
  });
});

describe("normalizeEquipment migration", () => {
  it("folds legacy array overflow slots into pack.contents", () => {
    const migrated = normalizeEquipment([
      null,
      "quarterstaff",
      null,
      ["Scholar's Pack", "Backpack"],
      "Component pouch",
      "Spellbook",
    ]);
    expect(migrated.mainHand).toBe("quarterstaff");
    expect(migrated.pack?.name).toBe("Scholar's Pack");
    expect(migrated.pack?.contents).toEqual(
      expect.arrayContaining([
        "Backpack",
        "Component pouch",
        "Spellbook",
      ]),
    );
  });

  it("folds a keyed other field into pack.contents", () => {
    const migrated = normalizeEquipment({
      armor: null,
      mainHand: null,
      offHand: null,
      pack: { name: "Scholar's Pack", contents: ["Backpack"] },
      other: "Spellbook",
    });
    expect(migrated.pack?.contents).toEqual(
      expect.arrayContaining(["Backpack", "Spellbook"]),
    );
  });
});

function completeActivity(
  character: Character,
  skillId: string,
): Character {
  const catalog = getCatalog();
  const ui = defaultTrainingUi();
  const withJob: Character = {
    ...character,
    activeJob: {
      kind: "activity",
      skillId,
      area: "The Keep",
      building: "Training Ground",
      room: "Drill Yard",
      activity: "Train",
      startedAt: Date.now() - 60_000,
      fills: 1,
      fillMsSec: 1,
      durationMs: 1,
    },
  };
  return applyTrainingAction(catalog, withJob, ui, { type: "complete-job" })
    .character;
}

describe("outfitter on feature gain", () => {
  it("assigns equipment on the first feature", () => {
    const catalog = getCatalog();
    let ch = createEmptyCompanion(catalog, {
      id: "c-outfit-1",
      name: "OneFeat",
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    expect(ch.features).toHaveLength(0);
    ch = completeActivity(ch, "f_09a1r3"); // Archery
    expect(ch.features).toHaveLength(1);
    expect(ch.equipment?.armor).toBe("chain_mail");
    expect(ch.equipment?.mainHand).toBe("longsword");
    expect(ch.equipment?.offHand).toBe("shield");
    expect(ch.equipment?.pack?.name).toBe("Dungeoneer's Pack");
  });

  it("keeps filling empty slots on later features without overwriting", () => {
    const catalog = getCatalog();
    let ch = createEmptyCompanion(catalog, {
      id: "c-outfit-2",
      name: "TwoFeat",
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    ch = completeActivity(ch, "f_09a1r3");
    ch = completeActivity(ch, "f_09b2s4");
    expect(ch.features).toHaveLength(2);
    expect(ch.equipment?.armor).toBe("chain_mail");
    expect(ch.equipment?.mainHand).toBe("longsword");
  });

  it("keeps existing mainHand on later outfitter visits while filling empty slots", () => {
    const catalog = getCatalog();
    let ch = createEmptyCompanion(catalog, {
      id: "c-outfit-3",
      name: "ThreeFeat",
      raceId: "human",
      alignment: { alignmentId: "lg" },
    });
    ch = completeActivity(ch, "f_09a1r3");
    ch = completeActivity(ch, "f_09b2s4");
    ch = {
      ...ch,
      equipment: {
        armor: null,
        mainHand: "rapier",
        offHand: null,
        pack: null,
      },
      featurePoints: Math.max(1, ch.featurePoints),
    };
    ch = completeActivity(ch, "f_09c3t5");
    expect(ch.features.length).toBeGreaterThanOrEqual(3);
    expect(ch.equipment?.mainHand).toBe("rapier");
    expect(ch.equipment?.offHand).toBe("shield");
    expect(ch.equipment?.armor).toBe("chain_mail");
  });
});

describe("companionToCombatant equipment", () => {
  const baseScores = {
    STR: 16,
    DEX: 14,
    CON: 14,
    INT: 10,
    WIS: 12,
    CHA: 8,
  };

  function fighterWith(
    equipment: Character["equipment"] | undefined,
  ): Character {
    return {
      id: "eq-fighter",
      name: "EqFighter",
      raceId: "human",
      alignment: { alignmentId: "lg" },
      featurePoints: 0,
      features: [
        {
          id: "f1",
          feature: ["Defense"],
          archetype: "Fighter",
        },
      ],
      cantrips: [],
      spells: [],
      abilityScores: baseScores,
      abilityScoresAssigned: true,
      originStory: null,
      unlocked: { areas: {}, buildings: {}, rooms: {} },
      activeJob: null,
      xp: 0,
      equipment: equipment ?? emptyEquipment(),
    };
  }

  it("uses equipment.json weapon damage and armor AC when slots are set", () => {
    const c = companionToCombatant(
      fighterWith({
        armor: "chain_mail",
        mainHand: "longsword",
        offHand: "shield",
        pack: null,
      }),
      0,
    );
    expect(c.weapon.name).toBe("Longsword");
    expect(c.weapon.damage).toEqual({ count: 1, sides: 8 });
    expect(c.ac).toBe(19);
  });

  it("outfits empty inventory from primary archetype", () => {
    const withEmpty = companionToCombatant(fighterWith(emptyEquipment()), 0);
    expect(withEmpty.weapon.name).toBe("Longsword");
    expect(withEmpty.ac).toBe(19);
  });

  it("unarmed + 10+DEX when there is no archetype to outfit from", () => {
    const c = companionToCombatant(
      {
        ...fighterWith(emptyEquipment()),
        features: [],
      },
      0,
    );
    expect(c.weapon.name).toMatch(/Unarmed/i);
    expect(c.ac).toBe(12);
  });

  it("Barbarian Unarmored Defense wins over an armor slot", () => {
    const c = companionToCombatant(
      {
        id: "eq-barb",
        name: "Barb",
        raceId: "human",
        alignment: { alignmentId: "cg" },
        featurePoints: 0,
        features: [{ id: "f1", feature: ["Rage"], archetype: "Barbarian" }],
        cantrips: [],
        spells: [],
        abilityScores: { ...baseScores, DEX: 14, CON: 16 },
        abilityScoresAssigned: true,
        originStory: null,
        unlocked: { areas: {}, buildings: {}, rooms: {} },
        activeJob: null,
        xp: 0,
        equipment: {
          armor: "chain_mail",
          mainHand: "greataxe",
          offHand: null,
          pack: null,
        },
      },
      0,
    );
    expect(c.ac).toBe(15);
    expect(c.weapon.name).toBe("Greataxe");
  });

  it("Monk Unarmored Defense wins over an armor slot", () => {
    const c = companionToCombatant(
      {
        id: "eq-monk",
        name: "Monk",
        raceId: "human",
        alignment: { alignmentId: "ln" },
        featurePoints: 0,
        features: [
          { id: "f1", feature: ["Martial Arts"], archetype: "Monk" },
        ],
        cantrips: [],
        spells: [],
        abilityScores: { ...baseScores, DEX: 16, WIS: 14 },
        abilityScoresAssigned: true,
        originStory: null,
        unlocked: { areas: {}, buildings: {}, rooms: {} },
        activeJob: null,
        xp: 0,
        equipment: {
          armor: "leather",
          mainHand: "shortsword",
          offHand: null,
          pack: null,
        },
      },
      0,
    );
    expect(c.ac).toBe(15);
  });

  it("Wizard combat uses quarterstaff from inventory", () => {
    const c = companionToCombatant(
      {
        id: "eq-wiz",
        name: "Wiz",
        raceId: "human",
        alignment: { alignmentId: "nn" },
        featurePoints: 0,
        features: [
          { id: "f1", feature: ["Arcane Recovery"], archetype: "Wizard" },
        ],
        cantrips: [],
        spells: [],
        abilityScores: { ...baseScores, DEX: 14, INT: 16 },
        abilityScoresAssigned: true,
        originStory: null,
        unlocked: { areas: {}, buildings: {}, rooms: {} },
        activeJob: null,
        xp: 0,
        equipment: emptyEquipment(),
      },
      0,
    );
    expect(c.weapon.name).toBe("Quarterstaff");
    expect(c.ac).toBe(12);
  });
});

describe("runDungeon determinism with equipment resolution", () => {
  it("same-seed runs stay byte-identical (loadout uses no rng)", () => {
    const party = JSON.parse(
      readFileSync(path.join(__dirname, "../data/sample-party.json"), "utf8"),
    ) as Character[];
    const withGear = party.map((p, i) =>
      i === 0
        ? {
            ...p,
            equipment: resolveDefaultLoadout(
              p.features?.[0]?.archetype || "Fighter",
            ),
          }
        : p,
    );
    const a = runDungeon({ seed: 42, party: withGear });
    const b = runDungeon({ seed: 42, party: withGear });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
