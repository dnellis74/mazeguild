import { describe, expect, it } from "vitest";
import { makeMonster } from "./adapter";
import { MONSTER_STATS } from "./encounters";
import { isMetalArmorId, weaponFromEquipmentId } from "./loadout";
import type { CharacterEquipment } from "@/training/types";

function fullEquipment(
  partial: Partial<CharacterEquipment> | undefined,
): CharacterEquipment {
  return {
    armor: partial?.armor ?? null,
    mainHand: partial?.mainHand ?? null,
    offHand: partial?.offHand ?? null,
    pack: partial?.pack ?? null,
  };
}

describe("monster equipment (CharacterEquipment)", () => {
  it("Goblin / Hobgoblin / Bugbear match the PC equipment shape and loadout", () => {
    expect(fullEquipment(MONSTER_STATS.Goblin!.equipment)).toEqual({
      armor: "leather",
      mainHand: "scimitar",
      offHand: "shield",
      pack: { name: "Carried", contents: ["shortbow"] },
    } satisfies CharacterEquipment);

    expect(fullEquipment(MONSTER_STATS.Hobgoblin!.equipment)).toEqual({
      armor: "chain_mail",
      mainHand: "longsword",
      offHand: "shield",
      pack: { name: "Carried", contents: ["longbow"] },
    } satisfies CharacterEquipment);

    expect(fullEquipment(MONSTER_STATS.Bugbear!.equipment)).toEqual({
      armor: "hide",
      mainHand: "morningstar",
      offHand: "shield",
      pack: { name: "Carried", contents: ["javelin"] },
    } satisfies CharacterEquipment);
  });

  it("derives wearingMetalArmor from equipment armor material", () => {
    expect(isMetalArmorId(MONSTER_STATS.Goblin!.equipment?.armor)).toBe(false);
    expect(isMetalArmorId(MONSTER_STATS.Hobgoblin!.equipment?.armor)).toBe(
      true,
    );
    expect(isMetalArmorId(MONSTER_STATS.Bugbear!.equipment?.armor)).toBe(false);

    const hob = makeMonster({
      id: "h1",
      name: "Hobgoblin 1",
      hp: 11,
      abilities: MONSTER_STATS.Hobgoblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Hobgoblin!.equipment),
      xpValue: 100,
    });
    expect(hob.wearingMetalArmor).toBe(true);

    const gob = makeMonster({
      id: "g1",
      name: "Goblin 1",
      hp: 7,
      abilities: MONSTER_STATS.Goblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Goblin!.equipment),
      xpValue: 50,
    });
    expect(gob.wearingMetalArmor).toBe(false);
  });

  it("wields mainHand from equipment (not a separate monster_weapons table)", () => {
    const gob = makeMonster({
      id: "g1",
      name: "Goblin 1",
      hp: 7,
      abilities: MONSTER_STATS.Goblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Goblin!.equipment),
      xpValue: 50,
    });
    const scimitar = weaponFromEquipmentId("scimitar")!;
    expect(gob.weapon.name).toBe(scimitar.name);
    expect(gob.weapon.damage).toEqual(scimitar.damage);

    const hob = makeMonster({
      id: "h1",
      name: "Hobgoblin 1",
      hp: 11,
      abilities: MONSTER_STATS.Hobgoblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Hobgoblin!.equipment),
      xpValue: 100,
    });
    // Catalog longsword is 1d8; versatile 1d10 is not applied while shield is equipped
    // (and the sim never upgrades versatile dice from an empty offhand today).
    expect(hob.weapon.name).toBe("Longsword");
    expect(hob.weapon.damage).toEqual({ count: 1, sides: 8 });
    expect(hob.weapon.properties.some((p) => /versatile/i.test(p))).toBe(true);
    expect(MONSTER_STATS.Hobgoblin!.equipment?.offHand).toBe("shield");
  });

  it("Bugbear has Brute; morningstar stays catalog 1d8", () => {
    expect(MONSTER_STATS.Bugbear!.features).toEqual([
      "Brute",
      "Surprise Attack",
    ]);

    const bug = makeMonster({
      id: "b1",
      name: "Bugbear 1",
      hp: 27,
      abilities: MONSTER_STATS.Bugbear!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Bugbear!.equipment),
      features: MONSTER_STATS.Bugbear!.features,
      xpValue: 200,
    });
    expect(bug.brute).toBe(true);
    expect(bug.weapon.name).toBe("Morningstar");
    expect(bug.weapon.damage).toEqual({ count: 1, sides: 8 });
    expect(bug.weapon.ranged).toBe(false);

    const gob = makeMonster({
      id: "g1",
      name: "Goblin 1",
      hp: 7,
      abilities: MONSTER_STATS.Goblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Goblin!.equipment),
      xpValue: 50,
    });
    expect(gob.brute).toBe(false);
  });

  it("derives AC from armor + shield + DEX (SRD MM totals)", () => {
    const gob = makeMonster({
      id: "g1",
      name: "Goblin 1",
      hp: 7,
      abilities: MONSTER_STATS.Goblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Goblin!.equipment),
      xpValue: 50,
    });
    // Leather 11 + DEX(+2) + shield 2 = 15
    expect(gob.ac).toBe(15);

    const hob = makeMonster({
      id: "h1",
      name: "Hobgoblin 1",
      hp: 11,
      abilities: MONSTER_STATS.Hobgoblin!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Hobgoblin!.equipment),
      xpValue: 100,
    });
    // Chain mail 16 + shield 2 = 18
    expect(hob.ac).toBe(18);

    const bug = makeMonster({
      id: "b1",
      name: "Bugbear 1",
      hp: 27,
      abilities: MONSTER_STATS.Bugbear!.abilities,
      equipment: fullEquipment(MONSTER_STATS.Bugbear!.equipment),
      features: MONSTER_STATS.Bugbear!.features,
      xpValue: 200,
    });
    // Hide 12 + DEX(max 2) + shield 2 = 16
    expect(bug.ac).toBe(16);
  });
});
