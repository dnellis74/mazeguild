import { DIR_DELTA, DIRS } from "./maze";
import type { Rng } from "./rng";
import type { Dir, Maze, Pos } from "./types";

/** Weight multiplier when a neighbor is closer to the exit (maze distance). */
export const PULL = 3;

/** Weight multiplier when reversing the previous step. */
export const BACKTRACK_PENALTY = 0.25;

export type WanderMove = { dir: Dir; nx: number; ny: number };

/**
 * One wandering step. Weighted random among open directions.
 * Tunables live here so maze generation and 5e math stay untouched.
 */
export function wanderStep(
  rng: Rng,
  maze: Maze,
  dist: number[][],
  pos: Pos,
  lastDir: Dir | null,
): WanderMove {
  const cell = maze.grid[pos.y][pos.x];
  const options: Array<WanderMove & { weight: number }> = [];

  for (const d of DIRS) {
    if (cell[d.dir]) continue;
    const nx = pos.x + d.dx;
    const ny = pos.y + d.dy;
    if (nx < 0 || nx >= maze.size || ny < 0 || ny >= maze.size) continue;
    let weight = 1;
    if (dist[ny][nx] < dist[pos.y][pos.x]) weight *= PULL;
    if (lastDir && d.dir === DIR_DELTA[lastDir].opp) weight *= BACKTRACK_PENALTY;
    options.push({ dir: d.dir, nx, ny, weight });
  }

  if (options.length === 0) {
    for (const d of DIRS) {
      if (cell[d.dir]) continue;
      options.push({
        dir: d.dir,
        nx: pos.x + d.dx,
        ny: pos.y + d.dy,
        weight: 1,
      });
    }
  }

  const total = options.reduce((s, o) => s + o.weight, 0);
  let roll = rng() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll <= 0) return { dir: o.dir, nx: o.nx, ny: o.ny };
  }
  const last = options[options.length - 1];
  return { dir: last.dir, nx: last.nx, ny: last.ny };
}
