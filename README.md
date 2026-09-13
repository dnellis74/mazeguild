# guildmaze

Prototype for an automated party dungeon crawler (**Maze of the Guild**). Players build characters (gear, level-ups) but never drive them. Characters run dungeons on their own, in parties of up to six drawn from a guild — including members who are offline. Death costs time, not a save file.

This repo is the **dungeon layer only**: a deterministic headless sim with a Wizardry-style replay UI.

## Loop

1. JSON in: companions from Town Square / training (`Character`) plus an RNG seed.
2. The sim maps each companion to a combatant from **features** (not a class sheet), generates a 20×20 maze, walks the **A\*** shortest path from entrance to exit, and schedules fights every **6d8** steps (mean 27, range 6–48).
3. Combat uses 5e-style math. Loot is flavor only.
4. JSON out: maze, full event log, XP score.
5. The UI replays the log. It has no game logic.

Same seed + party always produces byte-identical JSON.

Path length is deterministic per seed (corner-to-corner A\* on a perfect maze — typically on the order of ~40–80 steps, far shorter than the old weighted-wander mean of ~152). At 6d8 spacing that usually yields **about 2–3 encounters per run**, not the DMG’s 6–8 or the ~14 that 3d6-on-wander used to produce. Difficulty is still untuned against that pacing.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Welcome strangers in Town Square, train them in the city, select two or more, and **Quest**.

```bash
npm test    # determinism checks
npm run build
```

## JSON boundary

Every layer talks JSON. The sim, the renderer, and a future server never share live state — only logs.

**Input** (`DungeonInput`):

```json
{
  "seed": 99,
  "party": [
    {
      "id": "…",
      "name": "Pip",
      "raceId": "halfling",
      "features": [{ "archetype": "Rogue", "feature": ["Sneak Attack"], "id": "…" }],
      "abilityScores": { "STR": 8, "DEX": 16, "CON": 12, "INT": 13, "WIS": 10, "CHA": 14 },
      "…": "same Character blob as training / roster"
    }
  ]
}
```

Party members are training companions. `companionToCombatant` derives HP, AC, role, and weapons from earned features and scores.

**Output** (`DungeonResult`):

| Field | Meaning |
|---|---|
| `seed` | Echo of the input seed |
| `maze` | 20×20 grid, entrance `(0,0)`, exit `(19,19)` |
| `log` | Ordered events — this is the replay format |
| `score` | XP earned |
| `stepsTaken` | Cells walked |
| `cellsVisited` | Unique cells |
| `visited` | `"x,y"` keys in visit order |
| `partyAfter` | Per-companion id / XP / HP after the run (roster write-back) |

Headless:

```bash
curl -s -X POST http://localhost:3000/api/run \
  -H 'content-type: application/json' \
  -d @- <<'EOF'
{ "seed": 99, "party": [ …companions… ] }
EOF
```

Or import `runDungeon` from `src/sim` and call it in-process. The browser UI posts to `/api/run`; the API is the same function.

### Event log

Every record has an `event` tag. The important ones:

| Event | When |
|---|---|
| `run_start` | Seed, entrance, exit, party HP snapshot |
| `step` | One cell along the A\* route (position + facing) |
| `encounter_start` / `encounter_won` | Fight bookends; loot is flavor |
| `attack` / `heal` / `death` | Combat beats |
| `exit_reached` / `wipe` | How the run ended |
| `resurrections_owed` | Names of PCs at 0 HP |
| `run_end` | Score, steps, survivors |

`src/replay/project.ts` turns a log prefix into a render frame (position, facing, HP, narrative). The Wizardry components consume that and nothing else.

## Layout

```
src/sim/            headless sim (no React)
  rng.ts            mulberry32; same seed → same stream
  maze.ts           recursive-backtracker 20×20 + A* path
  rules.ts          attack / damage / healing math
  tactics.ts        action + target selection
  combat.ts         encounter loop
  encounterScaling.ts  XP-budget mixes (Goblin / Hobgoblin / Bugbear)
  encounters.ts     spawn via generateEncounter; flavor loot
  adapter.ts        companion → combatant (from features)
  run.ts            orchestration (A* walk + 6d8 encounter clock)
  types.ts          input / output / log contracts

src/training/       companion progression (shared Character type)
src/replay/         pure log → frame projection
src/components/wizardry/   CRT replay UI
src/app/api/run/    POST companions + seed → dungeon result
src/data/sample-party.json
```

Constraints the code is built around:

- **Rules** (`rules.ts`) never pick a target.
- **Tactics** (`tactics.ts`) never roll a die. A later written motivation prompt will bias this layer only.
- **Orchestration** (`run.ts`) wires maze path, encounters, and combat. It does not know 5e math.
- **Rendering** does not know 5e math, targeting, or how to walk a maze. It reads the log.

There is no `wander.ts`. The party never leaves the precomputed shortest path.

## Characters

Companions are the training `Character` blob (roster / Town Square / maze). There is no separate party generator — assemble parties in Town Square. `companionToCombatant` reads earned features, cantrips, spells, race, and ability scores to derive HP, AC, role, weapons, Lucky, Relentless Endurance, Sneak Attack, heal slots, and Lay on Hands.

## Combat (this layer)

- d20 + ability mod + proficiency vs AC; nat 20 crit (double weapon dice); nat 1 miss
- Finesse uses the better of STR/DEX; ranged uses DEX
- Cure Wounds `1d8 +` spell mod from remaining 1st-level slots; Paladin Lay on Hands is a HP pool
- Enemies: `generateEncounter` builds mixes of Goblin / Hobgoblin / Bugbear (max 3 monsters) against DMG-style XP thresholds; maze spawns hardcode target difficulty **`easy`**. There is no separate 10% hobgoblin roll.
- No rest inside the maze, so slots and HP persist across fights. With easy fights and only a few encounters per run, wipes should be rare — that is a side effect of the current constants, not a tuned design goal.

Encounter spacing is `dice(rng, 6, 8)` in `run.ts` (6d8). Pathing is `aStarPath` in `maze.ts`.

## Next layers

In rough order:

1. Difficulty and pacing so death actually threatens in a controlled way (path length, encounter interval, and XP budget need to be designed together)
2. Loot with mechanical effect
3. Guild / conscription (parties of up to six, including offline members)
4. A written motivation prompt that biases **tactics only**
5. Automatic full recovery on return to town (HP, Hit Dice, rest resources)
