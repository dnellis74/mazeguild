import type {
  Dir,
  DungeonResult,
  LogEvent,
  PartySnapshot,
  Pos,
} from "@/sim/types";

export type RunOutcome = "ongoing" | "exit" | "wipe" | "aborted";

export type ReplayFrame = {
  index: number;
  pos: Pos;
  facing: Dir;
  visited: string[];
  party: PartySnapshot[];
  inCombat: boolean;
  enemies: string[];
  score: number;
  lastNarrative: string;
  outcome: RunOutcome;
  done: boolean;
};

const START_FACING: Dir = "s";

export function describeEvent(e: LogEvent): string | null {
  switch (e.event) {
    case "run_start":
      return `The party enters the maze (seed ${e.seed}). First encounter in ${e.firstEncounterIn} steps.`;
    case "step":
      return null;
    case "encounter_start":
      return `Encounter! ${e.enemies.join(", ")}`;
    case "attack":
      if (!e.hit) return `${e.actor} misses ${e.target}.`;
      return `${e.actor} hits ${e.target}${e.crit ? " (CRIT)" : ""} for ${e.damage} (${e.targetHpAfter} hp).`;
    case "heal":
      return `${e.actor} heals ${e.target} for ${e.amount} (${e.targetHpAfter} hp).`;
    case "death":
      return `${e.name} falls.`;
    case "encounter_won":
      return `Victory. +${e.xpGained} xp. Loot: ${e.loot}.`;
    case "next_encounter_in":
      return `Next encounter in ${e.steps} steps.`;
    case "exit_reached":
      return `The party finds the exit after ${e.steps} steps.`;
    case "wipe":
      return `The party is wiped at (${e.pos.x},${e.pos.y}).`;
    case "aborted_step_cap":
      return `Run aborted at ${e.steps} steps.`;
    case "resurrections_owed":
      return `Resurrections owed: ${e.names.join(", ")}.`;
    case "run_end":
      return `Score ${e.score}. Survivors: ${e.survivors.join(", ") || "none"}.`;
    default:
      return null;
  }
}

/** Pure projection: renderer state from a prefix of the event log. */
export function projectFrame(
  result: DungeonResult,
  index: number,
): ReplayFrame {
  const cap = Math.max(-1, Math.min(index, result.log.length - 1));
  const events = result.log.slice(0, cap + 1);

  let pos: Pos = { ...result.maze.entrance };
  let facing: Dir = START_FACING;
  const visited: string[] = [`${pos.x},${pos.y}`];
  let party: PartySnapshot[] = [];
  let inCombat = false;
  let enemies: string[] = [];
  let score = 0;
  let lastNarrative = "";
  let outcome: RunOutcome = "ongoing";

  for (const e of events) {
    const line = describeEvent(e);
    if (line) lastNarrative = line;

    switch (e.event) {
      case "run_start":
        party = e.party.map((p) => ({ ...p }));
        pos = { ...e.entrance };
        break;
      case "step":
        pos = { ...e.to };
        facing = e.facing;
        visited.push(`${pos.x},${pos.y}`);
        inCombat = false;
        enemies = [];
        break;
      case "encounter_start":
        inCombat = true;
        enemies = [...e.enemies];
        break;
      case "attack":
        if (e.hit && e.targetHpAfter !== undefined) {
          party = party.map((p) =>
            p.name === e.target ? { ...p, hp: e.targetHpAfter! } : p,
          );
        }
        break;
      case "heal":
        party = party.map((p) =>
          p.name === e.target ? { ...p, hp: e.targetHpAfter } : p,
        );
        break;
      case "death":
        party = party.map((p) => (p.name === e.name ? { ...p, hp: 0 } : p));
        enemies = enemies.filter((n) => n !== e.name);
        break;
      case "encounter_won":
        inCombat = false;
        enemies = [];
        score = e.xpTotal;
        break;
      case "exit_reached":
        outcome = "exit";
        inCombat = false;
        break;
      case "wipe":
        outcome = "wipe";
        inCombat = false;
        break;
      case "aborted_step_cap":
        outcome = "aborted";
        break;
      case "run_end":
        score = e.score;
        break;
      default:
        break;
    }
  }

  return {
    index: cap,
    pos,
    facing,
    visited,
    party,
    inCombat,
    enemies,
    score,
    lastNarrative,
    outcome,
    done: outcome !== "ongoing" || cap >= result.log.length - 1,
  };
}

export function isNarrative(e: LogEvent): boolean {
  return e.event !== "step";
}
