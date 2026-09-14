import { describe, expect, it } from "vitest";
import { describeEvent, formatD20Roll, narrativeLines } from "./project";

describe("formatD20Roll", () => {
  it("shows a single d20 and total", () => {
    expect(formatD20Roll({ d20: 14, d20Rolls: [14], total: 19 })).toBe(
      " (d20 14; total 19)",
    );
  });

  it("shows both faces on advantage", () => {
    expect(
      formatD20Roll({
        d20: 18,
        d20Rolls: [3, 18],
        total: 23,
        advantageMode: "advantage",
      }),
    ).toBe(" (advantage 3, 18 → 18; total 23)");
  });

  it("shows both faces on disadvantage", () => {
    expect(
      formatD20Roll({
        d20: 4,
        d20Rolls: [15, 4],
        total: 8,
        advantageMode: "disadvantage",
      }),
    ).toBe(" (disadvantage 15, 4 → 4; total 8)");
  });
});

describe("describeEvent attack advantage", () => {
  it("mentions advantage dice on a hit", () => {
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
        d20: 18,
        d20Rolls: [3, 18],
        total: 23,
      }),
    ).toBe(
      "Elowen hits Hobgoblin with Shocking Grasp (advantage 3, 18 → 18; total 23) for 8 (3 hp).",
    );
  });

  it("mentions disadvantage dice on a miss", () => {
    expect(
      describeEvent({
        event: "attack",
        round: 1,
        actor: "Goblin",
        target: "Elowen",
        hit: false,
        used: "Scimitar",
        advantageMode: "disadvantage",
        d20: 4,
        d20Rolls: [15, 4],
        total: 8,
      }),
    ).toBe(
      "Goblin misses Elowen with Scimitar (disadvantage 15, 4 → 4; total 8).",
    );
  });

  it("omits the note on a flat roll without dice fields", () => {
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

  it("shows a flat d20 when present", () => {
    expect(
      describeEvent({
        event: "attack",
        round: 1,
        actor: "Fighter",
        target: "Goblin",
        hit: true,
        damage: 6,
        targetHpAfter: 1,
        used: "Longsword",
        d20: 12,
        d20Rolls: [12],
        total: 16,
      }),
    ).toBe(
      "Fighter hits Goblin with Longsword (d20 12; total 16) for 6 (1 hp).",
    );
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
        d20: 18,
        d20Rolls: [3, 18],
        total: 20,
      },
    ]);
    expect(lines).toEqual([
      "A misses B with Club (advantage 3, 18 → 18; total 20).",
    ]);
  });
});
