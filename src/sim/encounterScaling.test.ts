import { describe, expect, it } from "vitest";
import {
  adjustedMonsterXp,
  difficultyAchievedFor,
  encounterMultiplier,
  generateEncounter,
  monsterCountBucket,
  partyThreshold,
} from "./encounterScaling";

describe("monsterCountBucket", () => {
  it("maps counts onto the DMG range keys", () => {
    expect(monsterCountBucket(1)).toBe("1");
    expect(monsterCountBucket(2)).toBe("2");
    expect(monsterCountBucket(4)).toBe("3-6");
    expect(monsterCountBucket(9)).toBe("7-10");
    expect(monsterCountBucket(12)).toBe("11-14");
    expect(monsterCountBucket(20)).toBe("15+");
  });
});

describe("encounterMultiplier", () => {
  it("uses the base table for a party of 4", () => {
    expect(encounterMultiplier(1, 4)).toBe(1);
    expect(encounterMultiplier(2, 4)).toBe(1.5);
    expect(encounterMultiplier(4, 4)).toBe(2);
  });

  it("shifts down one column for a party of 6", () => {
    expect(encounterMultiplier(1, 6)).toBe(0.5);
    expect(encounterMultiplier(2, 6)).toBe(1);
    expect(encounterMultiplier(4, 6)).toBe(1.5);
  });
});

describe("DMG worked example", () => {
  it("rates one bugbear and three hobgoblins as Hard for the sample party", () => {
    // DMG: three 3rd-level + one 2nd-level → Hard threshold 825.
    const party = [{ level: 3 }, { level: 3 }, { level: 3 }, { level: 2 }];
    expect(partyThreshold(party, "hard")).toBe(825);

    // 1 Bugbear (200) + 3 Hobgoblins (100 each) = 500 XP.
    // Four monsters, party of 4 → ×2 → adjusted 1,000 → Hard.
    const monsters = [
      { type: "Bugbear", count: 1 },
      { type: "Hobgoblin", count: 3 },
    ];
    const { totalXP, adjustedXP } = adjustedMonsterXp(monsters, 4);
    expect(totalXP).toBe(500);
    expect(adjustedXP).toBe(1000);
    expect(difficultyAchievedFor(party, adjustedXP)).toBe("hard");
  });
});

describe("generateEncounter", () => {
  it("is deterministic for the same seed", () => {
    const party = Array.from({ length: 6 }, () => ({ level: 1 }));
    const a = generateEncounter(party, "easy", 42, ["Goblin", "Hobgoblin"]);
    const b = generateEncounter(party, "easy", 42, ["Goblin", "Hobgoblin"]);
    expect(a).toEqual(b);
  });

  it("lands easy encounters in the easy band for a level-1 party of six", () => {
    const party = Array.from({ length: 6 }, () => ({ level: 1 }));
    const plan = generateEncounter(party, "easy", 7, ["Goblin", "Hobgoblin"]);
    expect(plan.monsters.length).toBeGreaterThan(0);
    expect(plan.adjustedXP).toBeGreaterThanOrEqual(partyThreshold(party, "easy"));
    expect(plan.adjustedXP).toBeLessThan(partyThreshold(party, "medium"));
    expect(plan.difficultyAchieved).toBe("easy");
  });
});
