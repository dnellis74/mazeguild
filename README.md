# guildmaze

Prototype for an automated party dungeon crawler (**Maze of the Guild**). Players build characters (gear, level-ups) but never drive them. Characters run dungeons on their own, in parties of up to six drawn from a guild — including members who are offline. Death costs time, not a save file.

This repo is the **dungeon layer only**: a deterministic headless sim with a Wizardry-style replay UI.

## Loop

1. JSON in: up to six [SRD 5.1](https://dnd.wizards.com/resources/systems-reference-document) character stat blocks plus an RNG seed.
2. The sim generates a 20×20 maze, wanders toward the exit, and rolls encounters every 3d6 steps.
3. Combat uses 5e SRD math. Loot is flavor only.
4. JSON out: maze, full event log, XP score.
5. The UI replays the log. It has no game logic.

Same seed + party always produces byte-identical JSON.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set a seed, hit **RUN**, then play / step the log. Seed `99` currently exits with survivors; many other seeds TPK.

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
  "party": [ { "name": "Pip", "class": "Monk", "race": "Halfling", "...": "SRD 5.1 stat block" } ]
}
```

Party members are the objects emitted by `tools/srd_character_generator.py`. `name` is optional; the adapter invents one from race + class if it is missing.

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

Headless:

```bash
curl -s -X POST http://localhost:3000/api/run \
  -H 'content-type: application/json' \
  -d @- <<'EOF'
{ "seed": 99, "party": [ ...six SRD characters... ] }
EOF
```

Or import `runDungeon` from `src/sim` and call it in-process. The browser UI does that directly; the API is the same function.

### Event log

Every record has an `event` tag. The important ones:

| Event | When |
|---|---|
| `run_start` | Seed, entrance, exit, party HP snapshot |
| `step` | One wander step (position + facing) |
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
  maze.ts           recursive-backtracker 20×20
  wander.ts         weighted wander, exit-ward pull
  rules.ts          SRD 5.1 attack / damage / healing math
  tactics.ts        action + target selection
  combat.ts         encounter loop
  encounters.ts     goblin / hobgoblin spawns, flavor loot
  adapter.ts        SRD JSON → combatant
  run.ts            orchestration
  types.ts          input / output / log contracts

src/replay/         pure log → frame projection
src/components/wizardry/   CRT replay UI
src/app/api/run/    POST JSON in, JSON out
src/data/sample-party.json
tools/srd_character_generator.py
```

Constraints the code is built around:

- **Rules** (`rules.ts`) never pick a target.
- **Tactics** (`tactics.ts`) never roll a die. A later written motivation prompt will bias this layer only.
- **Orchestration** (`run.ts`) wires maze, wander, encounters, and combat. It does not know 5e math.
- **Rendering** does not know 5e math, targeting, or how to walk a maze. It reads the log.

## Characters

The generator is SRD 5.1 only (level 1, Acolyte background, SRD subraces). Ability-score assignment uses the standard array plus a class priority order — that method is **not** in the SRD; see the script docstring.

```bash
python3 tools/srd_character_generator.py --seed 7 -n 6 --out party.json
```

Paste or swap that JSON into `src/data/sample-party.json` (add a `name` field per character). The adapter reads HP, AC, ability scores, weapons, Halfling Lucky, Relentless Endurance, Sneak Attack, spell slots, and Lay on Hands.

## Combat (this layer)

- d20 + ability mod + proficiency vs AC; nat 20 crit (double weapon dice); nat 1 miss
- Finesse uses the better of STR/DEX; ranged uses DEX
- Cure Wounds `1d8 +` spell mod from remaining 1st-level slots; Paladin Lay on Hands is a HP pool
- Enemies: 1–2 goblins (SRD), 10% chance each is a hobgoblin
- No rest inside the maze, so slots and HP persist across fights. Wipes are common. That is intended; difficulty is still untuned.

Wander tunables live in `src/sim/wander.ts` (`PULL = 3`, `BACKTRACK_PENALTY = 0.25`).

## Next layers

In rough order:

1. Difficulty tuning so death actually threatens in a controlled way
2. Loot with mechanical effect
3. Persistence between runs
4. Guild / conscription (parties of up to six, including offline members)
5. A written motivation prompt that biases **tactics only**
