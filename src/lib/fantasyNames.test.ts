import { describe, expect, it } from "vitest";
import {
  fcgRaceKey,
  generateFantasyName,
  generateUniqueFantasyName,
} from "@/lib/fantasyNames";

describe("fantasyNames", () => {
  it("maps guild race ids onto FCG keys", () => {
    expect(fcgRaceKey("halfelf")).toBe("halfElf");
    expect(fcgRaceKey("halforc")).toBe("halfOrc");
    expect(fcgRaceKey("elf")).toBe("elf");
    expect(fcgRaceKey("unknown")).toBe("human");
  });

  it("generates a non-empty name for each PHB race", () => {
    const races = [
      "dwarf",
      "elf",
      "halfling",
      "human",
      "dragonborn",
      "gnome",
      "halfelf",
      "halforc",
      "tiefling",
    ];
    for (const raceId of races) {
      const male = generateFantasyName(raceId, { gender: "male", seed: raceId + "-m" });
      const female = generateFantasyName(raceId, {
        gender: "female",
        seed: raceId + "-f",
      });
      expect(male.name.length).toBeGreaterThan(1);
      expect(female.name.length).toBeGreaterThan(1);
      expect(male.gender).toBe("male");
      expect(female.gender).toBe("female");
    }
  });

  it("avoids names already taken when possible", () => {
    const first = generateFantasyName("human", { gender: "male", seed: "taken-a" });
    const next = generateUniqueFantasyName("human", [first.name], {
      gender: "male",
      attempts: 20,
    });
    expect(next.name.toLowerCase()).not.toBe(first.name.toLowerCase());
  });
});
