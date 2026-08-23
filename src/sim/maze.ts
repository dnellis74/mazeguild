import type { Cell, Dir, Maze, Pos } from "./types";
import type { Rng } from "./rng";

export const DIRS: ReadonlyArray<{
  dir: Dir;
  dx: number;
  dy: number;
  opp: Dir;
}> = [
  { dir: "n", dx: 0, dy: -1, opp: "s" },
  { dir: "e", dx: 1, dy: 0, opp: "w" },
  { dir: "s", dx: 0, dy: 1, opp: "n" },
  { dir: "w", dx: -1, dy: 0, opp: "e" },
];

export const DIR_DELTA: Record<Dir, { dx: number; dy: number; opp: Dir }> = {
  n: { dx: 0, dy: -1, opp: "s" },
  e: { dx: 1, dy: 0, opp: "w" },
  s: { dx: 0, dy: 1, opp: "n" },
  w: { dx: -1, dy: 0, opp: "e" },
};

function emptyCell(): Cell {
  return { n: true, e: true, s: true, w: true };
}

/** Recursive-backtracker perfect maze. Entrance (0,0), exit (n-1,n-1). */
export function generateMaze(rng: Rng, size = 20): Maze {
  const grid: Cell[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < size; x++) row.push(emptyCell());
    grid.push(row);
  }

  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const stack: Pos[] = [{ x: 0, y: 0 }];
  visited[0][0] = true;

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const options: Array<{ dir: Dir; nx: number; ny: number; opp: Dir }> = [];
    for (const d of DIRS) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx]) {
        options.push({ dir: d.dir, nx, ny, opp: d.opp });
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(rng() * options.length)];
    grid[cur.y][cur.x][pick.dir] = false;
    grid[pick.ny][pick.nx][pick.opp] = false;
    visited[pick.ny][pick.nx] = true;
    stack.push({ x: pick.nx, y: pick.ny });
  }

  return {
    size,
    grid,
    entrance: { x: 0, y: 0 },
    exit: { x: size - 1, y: size - 1 },
  };
}

/** Maze-distance from every cell to the exit (BFS through open passages). */
export function distanceToExit(maze: Maze): number[][] {
  const { size, grid, exit } = maze;
  const dist = Array.from({ length: size }, () => Array(size).fill(Infinity));
  const queue: Pos[] = [{ x: exit.x, y: exit.y }];
  dist[exit.y][exit.x] = 0;

  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const d of DIRS) {
      if (grid[y][x][d.dir]) continue;
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (dist[ny][nx] > dist[y][x] + 1) {
        dist[ny][nx] = dist[y][x] + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

export function hasWall(maze: Maze, pos: Pos, dir: Dir): boolean {
  if (pos.x < 0 || pos.y < 0 || pos.x >= maze.size || pos.y >= maze.size) {
    return true;
  }
  return maze.grid[pos.y][pos.x][dir];
}

export function step(pos: Pos, dir: Dir): Pos {
  const d = DIR_DELTA[dir];
  return { x: pos.x + d.dx, y: pos.y + d.dy };
}

export function turnLeft(dir: Dir): Dir {
  const order: Dir[] = ["n", "w", "s", "e"];
  return order[(order.indexOf(dir) + 1) % 4];
}

export function turnRight(dir: Dir): Dir {
  const order: Dir[] = ["n", "e", "s", "w"];
  return order[(order.indexOf(dir) + 1) % 4];
}
