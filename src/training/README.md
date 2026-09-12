# Training domain

Pure rules and view DTOs for companions in the walled city: explore places,
spend feature points, then export into the maze. UI lives outside this folder;
this package should stay free of React and `localStorage`.

## Player flow

```
Town Square (/)
  ├─ Welcome a Stranger → character-initialization.html → back to /
  ├─ 1 companion selected → Enter the City (/training?id=…)
  └─ 2+ selected → Quest (export on square → /quest maze, auto-play)
```

**Explore** (`TrainingClient` on `/training`) starts in the world. Crumbs mirror
location (`Areas / Walled City / …`). Tap the companion’s name for the sheet;
**Return** restores the world spot (or Town Square if the sheet was opened
directly).

**Town Square** is both:

1. The adventure hub at `/` (roster, Welcome, Quest).
2. A building under **Walled City** on the world map — always unlocked, listed
   beside Tavern / Cathedral / Library. Selecting it returns to the roster hub
   at `/` (character selection). Portal activity defs in `townSquare.ts` back
   hub actions such as Welcome a Stranger.

## Persistence

| Key | Where | Role |
|-----|--------|------|
| `mazeguild.roster` | `src/lib/rosterStorage.ts` (+ creation HTML) | Multi-companion list |
| `mazeguild.character` | legacy | Migrated into the roster once on load |

Creation assigns a race-appropriate display name (`fantasy-content-generator`,
random gender) via `POST /api/names`. Clients must keep the roster shape in sync.

## HTTP API

Thin routes under `src/app/api/training/` that load the catalog, migrate the
character blob, and call into this package.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET` | `/api/training/catalog` | — | Counts / timing summary |
| `POST` | `/api/training/view` | `{ character, ui }` | `{ character, ui, view }` |
| `POST` | `/api/training/action` | `{ character, ui, action }` | `{ character, ui, view, toast?, jobRunning?, navigate? }` |
| `POST` | `/api/training/export` | `{ character }` | `{ character: SrdCharacter, label }` |
| `POST` | `/api/names` | `{ raceId, gender?, taken? }` | `{ name, gender, race, seed }` |

`navigate` is set for Town Square portal actions; the client follows it
(`{id}` → current roster id). Feature activities start timed jobs instead.

## Module map

| File | Responsibility |
|------|----------------|
| `types.ts` | Character, UI state, actions, jobs |
| `catalog.ts` | Load `public/data` (skills, races, timing, …) |
| `character.ts` | Migrate / validate / default UI |
| `world.ts` | Area → building → room tree from skills; inject Town Square; unlock helpers |
| `townSquare.ts` | Portal building constants and activity → href map |
| `actions.ts` | `applyTrainingAction` reducer |
| `view.ts` | Sheet / world / pending-choice DTOs for the client |
| `toSrd.ts` | Training character → maze `SrdCharacter` |
| `abilities.ts` / `features.ts` / `magic.ts` / `origin.ts` | Point-buy, prereqs, cantrips/spells, origin prompt |
| `training.test.ts` | Domain tests |

## Related UI (not in this folder)

| Route / file | Role |
|--------------|------|
| `/` · `TownSquareClient` | Roster hub |
| `/training` · `TrainingClient` | World + sheet for one companion |
| `/quest` · `QuestRunClient` | Takes stashed party → `GameClient` (maze auto-starts) |
| `/character-initialization.html` | Race / alignment intake → named roster entry |

Maze combat and replay live under `src/sim/` and `src/components/wizardry/`.
