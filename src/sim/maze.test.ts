import { describe, expect, it } from "vitest";
import { aStarPath, dirBetween, distanceToExit, generateMaze, hasWall } from "./maze";
import { createRng } from "./rng";

describe("aStarPath", () => {
  it("finds a walkable shortest path from entrance to exit", () => {
    const maze = generateMaze(createRng(42), 20);
    const path = aStarPath(maze, maze.entrance, maze.exit);
    const dist = distanceToExit(maze);

    expect(path[0]).toEqual(maze.entrance);
    expect(path.at(-1)).toEqual(maze.exit);
    expect(path.length - 1).toBe(dist[maze.entrance.y][maze.entrance.x]);

    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];
      const facing = dirBetween(from, to);
      expect(hasWall(maze, from, facing)).toBe(false);
    }
  });

  it("never revisits a cell on a perfect maze", () => {
    const maze = generateMaze(createRng(7), 20);
    const path = aStarPath(maze, maze.entrance, maze.exit);
    const keys = path.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
