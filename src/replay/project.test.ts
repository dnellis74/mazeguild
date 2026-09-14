import { describe, expect, it } from "vitest";
import { describeEvent, narrativeLines } from "./project";

describe("describeEvent attack advantage", () => {
  it("mentions advantage on a hit", () => {
    expect(
      describeEvent({
        event: "attack",
        round: 1,
        actor: "Elowen",
        target: "Hobgoblin",
        hit: true,
        damage: 8,
        targetHpAfter: 3,
        used: "Shocking Grasp",
        advantageMode: "advantage",
      }),
    ).toBe(
      "Elowen hits Hobgoblin with Shocking Grasp (advantage) for 8 (3 hp).",
    );
  });

  it("mentions disadvantage on a miss", () => {
    expect(
      describeEvent({
        event: "attack",
        round: 1,
        actor: "Goblin",
        target: "Elowen",
        hit: false,
        used: "Scimitar",
        advantageMode: "disadvantage",
      }),
    ).toBe("Goblin misses Elowen with Scimitar (disadvantage).");
  });

  it("omits the note on a flat roll", () => {
    expect(
      describeEvent({
        event: "attack",
        round: 1,
        actor: "Fighter",
        target: "Goblin",
        hit: true,
        crit: true,
        damage: 12,
        targetHpAfter: 0,
        used: "Longsword",
      }),
    ).toBe("Fighter hits Goblin with Longsword (CRIT) for 12 (0 hp).");
  });
});

describe("narrativeLines", () => {
  it("matches EventLog filtering (skips steps, keeps attacks)", () => {
    const lines = narrativeLines([
      {
        event: "step",
        n: 1,
        from: { x: 0, y: 0 },
        to: { x: 0, y: 1 },
        facing: "s",
      },
      {
        event: "attack",
        round: 1,
        actor: "A",
        target: "B",
        hit: false,
        used: "Club",
        advantageMode: "advantage",
      },
    ]);
    expect(lines).toEqual(["A misses B with Club (advantage)."]);
  });
});
