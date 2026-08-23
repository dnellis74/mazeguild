import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aStarPath } from "./maze";
import { runDungeon } from "./run";
import type { SrdCharacter } from "./types";

const party = JSON.parse(
  readFileSync(path.join(__dirname, "../data/sample-party.json"), "utf8"),
) as SrdCharacter[];

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

  it("follows the A* shortest path without revisiting cells", () => {
    const result = runDungeon({ seed: 42, party });
    const route = aStarPath(result.maze, result.maze.entrance, result.maze.exit);
    const expected = route.map((p) => `${p.x},${p.y}`);
    expect(result.visited).toEqual(expected.slice(0, result.visited.length));
    expect(result.stepsTaken).toBe(result.visited.length - 1);
  });
});
