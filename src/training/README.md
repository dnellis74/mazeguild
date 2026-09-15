# Training domain

Pure rules and view DTOs for companions in the walled city: explore places,
spend feature points, then quest into the maze. UI lives outside this folder;
this package should stay free of React and `localStorage`.

## Player flow

```
Town Square (/)
  ├─ Welcome a Stranger → /character → POST /api/companions → /
  ├─ 1 companion selected → Enter the City (/training?id=…)
  └─ 2+ selected → Quest (stash companions → /quest maze, auto-play)
```

**Explore** (`TrainingClient` on `/training`) starts in the world. Crumbs mirror
location (`Town Gate / Walled City / …`). Tap the companion’s name for the sheet;
**Return** restores the world spot (or Town Square if the sheet was opened
directly).

**Town Square** is both:

1. The adventure hub at `/` (roster, Welcome, Quest).
2. A building under **Walled City** on the world map — selecting it returns to `/`.

## Persistence

| Key | Where | Role |
|-----|--------|------|
| `mazeguild.roster` | `src/lib/rosterStorage.ts` | Multi-companion list (`Character[]`) |

A companion is one shared `Character` blob. Creation finishes via
`createEmptyCompanion` (`POST /api/companions`). Maze XP/HP write back onto the
roster when returning to town.

## HTTP API

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET` | `/api/training/catalog` | — | Counts / timing summary |
| `POST` | `/api/training/view` | `{ character, ui }` | `{ character, ui, view }` |
| `POST` | `/api/training/action` | `{ character, ui, action }` | `{ character, ui, view, toast?, jobRunning?, navigate? }` |
| `POST` | `/api/companions` | `{ raceId, alignmentId, … }` | `{ companion }` |
| `POST` | `/api/names` | `{ raceId, gender?, taken? }` | `{ name, gender, race, seed }` |

Creation catalog comes from `getCharacterInitData()` on the `/character` server
page. Direct alignment pick uses `pickDefiningExperienceForAlignment` in the
client (`/api/companions` still fills experience if omitted).

## Module map

| File | Responsibility |
|------|----------------|
| `types.ts` | Character, UI state, actions, jobs |
| `companion.ts` | Empty companion factory + labels |
| `catalog.ts` | Load `@/data` |
| `character.ts` | Migrate / validate / default UI |
| `world.ts` | Area → building → room tree; inject Town Square |
| `townSquare.ts` | Hub building constants |
| `actions.ts` | `applyTrainingAction` reducer |
| `view.ts` | Sheet / world DTOs |
| `abilities.ts` / `features.ts` / `magic.ts` / `origin.ts` | Point-buy, prereqs, magic, origin |

## Related UI

| Route / file | Role |
|--------------|------|
| `/` · `TownSquareClient` | Roster hub |
| `/training` · `TrainingClient` | World + sheet |
| `/quest` · `QuestPageClient` | Stashed party → maze |
| `/character` · `CharacterInitClient` | Race / alignment wizard → `POST /api/companions` |

Maze combat: `companionToCombatant` in `src/sim/`.
