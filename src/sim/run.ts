import { characterToCombatant } from "./adapter";
import { runCombat } from "./combat";
import { pickLoot, spawnEncounter } from "./encounters";
import { levelForXp } from "./leveling";
import { applyXp } from "./rules";
import { aStarPath, dirBetween, generateMaze } from "./maze";
import { createRng, dice } from "./rng";
import { PARTY_CAP } from "@/gen/data";
import type { DungeonInput, DungeonResult, LogEvent } from "./types";

const STEP_CAP = 5000;

/**
 * Headless dungeon run. JSON in, JSON out.
 * Same seed + party always produces byte-identical JSON.
 */
export function runDungeon(input: DungeonInput): DungeonResult {
  const seed = input.seed >>> 0;
  const rng = createRng(seed);
  const maze = generateMaze(rng, 20);
  const route = aStarPath(maze, maze.entrance, maze.exit);
  const party = input.party.slice(0, PARTY_CAP).map(characterToCombatant);
  const partyLevels = party.map((member) => ({
    level: levelForXp(member.className, member.xp),
  }));

  const log: LogEvent[] = [];
  let pos = { x: maze.entrance.x, y: maze.entrance.y };
  let routeIndex = 0;
  let stepsTaken = 0;
  let stepsUntilEncounter = dice(rng, 6, 8);
  let score = 0;
  const visited = new Set<string>([`${pos.x},${pos.y}`]);

  log.push({
    event: "run_start",
    seed,
    entrance: { x: maze.entrance.x, y: maze.entrance.y },
    exit: { x: maze.exit.x, y: maze.exit.y },
    firstEncounterIn: stepsUntilEncounter,
    party: party.map((p) => ({
      name: p.name,
      class: p.className,
      race: p.race,
      hp: p.hp,
      maxHp: p.maxHp,
      ac: p.ac,
      xp: p.xp,
    })),
  });

  while (true) {
    if (pos.x === maze.exit.x && pos.y === maze.exit.y) {
      log.push({ event: "exit_reached", steps: stepsTaken, pos: { ...pos } });
      break;
    }
    if (!party.some((p) => p.alive)) {
      log.push({ event: "wipe", steps: stepsTaken, pos: { ...pos } });
      break;
    }

    const next = route[routeIndex + 1];
    if (!next) {
      log.push({ event: "aborted_step_cap", steps: stepsTaken });
      break;
    }
    const from = { x: pos.x, y: pos.y };
    const facing = dirBetween(from, next);
    pos = { x: next.x, y: next.y };
    routeIndex += 1;
    stepsTaken += 1;
    visited.add(`${pos.x},${pos.y}`);
    stepsUntilEncounter -= 1;

    log.push({
      event: "step",
      n: stepsTaken,
      from,
      to: { ...pos },
      facing,
    });

    const atExit = pos.x === maze.exit.x && pos.y === maze.exit.y;
    if (stepsUntilEncounter <= 0 && !atExit) {
      const livingLevels = party
        .filter((member) => member.alive)
        .map((member) => ({
          level: levelForXp(member.className, member.xp),
        }));
      const enemies = spawnEncounter(
        rng,
        stepsTaken,
        livingLevels.length > 0 ? livingLevels : partyLevels,
      );
      log.push({
        event: "encounter_start",
        pos: { ...pos },
        step: stepsTaken,
        enemies: enemies.map((e) => e.name),
      });

      const survived = runCombat(rng, party, enemies, log);
      if (survived) {
        const gained = enemies.reduce((s, e) => s + e.xpValue, 0);
        const survivors = party.filter((p) => p.alive);
        const share =
          survivors.length > 0 ? Math.floor(gained / survivors.length) : 0;
        score += gained;
        for (const p of survivors) {
          applyXp(p, share);
          log.push({
            event: "xp_gain",
            name: p.name,
            amount: share,
            xpAfter: p.xp,
          });
        }
        log.push({
          event: "encounter_won",
          xpGained: gained,
          loot: pickLoot(rng),
        });
      }
      stepsUntilEncounter = dice(rng, 6, 8);
      log.push({ event: "next_encounter_in", steps: stepsUntilEncounter });
    }

    if (stepsTaken > STEP_CAP) {
      log.push({ event: "aborted_step_cap", steps: stepsTaken });
      break;
    }
  }

  const dead = party.filter((p) => !p.alive).map((p) => p.name);
  if (dead.length > 0) {
    log.push({ event: "resurrections_owed", names: dead });
  }
  log.push({
    event: "run_end",
    score,
    stepsTaken,
    survivors: party.filter((p) => p.alive).map((p) => p.name),
  });

  return {
    seed,
    maze: {
      size: maze.size,
      grid: maze.grid,
      entrance: maze.entrance,
      exit: maze.exit,
    },
    log,
    score,
    stepsTaken,
    cellsVisited: visited.size,
    visited: [...visited],
  };
}
