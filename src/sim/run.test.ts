import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aStarPath } from "./maze";
import { runDungeon } from "./run";
import type { Character } from "@/training/types";

const party = JSON.parse(
  readFileSync(path.join(__dirname, "../data/sample-party.json"), "utf8"),
) as Character[];

describe("runDungeon", () => {
  it("is byte-identical for the same seed and party", () => {
    const a = runDungeon({ seed: 42, party });
    const b = runDungeon({ seed: 42, party });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("emits a 20x20 maze and a closed log", () => {
    const result = runDungeon({ seed: 42, party });
    expect(result.maze.size).toBe(20);
    expect(result.maze.grid).toHaveLength(20);
    expect(result.maze.grid[0]).toHaveLength(20);
    expect(result.log[0]?.event).toBe("run_start");
    expect(result.log.at(-1)?.event).toBe("run_end");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("changes output when the seed changes", () => {
    const a = runDungeon({ seed: 42, party });
    const b = runDungeon({ seed: 43, party });
    expect(JSON.stringify(a.maze)).not.toBe(JSON.stringify(b.maze));
  });

  it("emits partyAfter with matching ids and xp", () => {
    const result = runDungeon({ seed: 42, party });
    expect(result.partyAfter).toHaveLength(party.length);
    expect(result.partyAfter.map((p) => p.id)).toEqual(party.map((p) => p.id));
    for (const member of result.partyAfter) {
      expect(member.xp).toBeGreaterThanOrEqual(0);
      expect(member.hp).toBeGreaterThanOrEqual(0);
      expect(member.maxHp).toBeGreaterThan(0);
    }
  });

  it("includes EventLog narrative lines in the result JSON", () => {
    const result = runDungeon({ seed: 42, party });
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.narrative[0]).toMatch(/enters the maze/);
    expect(result.narrative.some((line) => /Encounter!/.test(line))).toBe(true);
    // Silent step events are omitted from narrative (same as the UI).
    expect(result.narrative.every((line) => line.length > 0)).toBe(true);
  });
});
