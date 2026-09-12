# Training domain API

Rules for the character training loop live in `src/training/`. The React hub
(`TrainingClient`) renders view DTOs and posts actions for one roster character.

## Surfaces

| Surface | Entry | Persistence / handoff |
|---------|-------|------------------------|
| Town Square | `/` (hub) · Explore → Walled City → Town Square | Roster hub; world portals open UIs (create / train / quest) |
| Creation | Welcome a Stranger → `character-initialization.html` | Appends to roster, returns to `/` |
| Train / Explore Town | `/training?id=&tab=` | Upserts that roster entry |
| Quest | `/quest?ids=` (2+ selected) | Export each → `GameClient({ party })` → maze |

Town Square is **not** a skill building. It sits beside Tavern / Cathedral / Library in
the Walled City. Its activities navigate to other surfaces instead of earning features.

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET` | `/api/training/catalog` | — | Static counts / timing summary |
| `POST` | `/api/training/view` | `{ character, ui }` | `{ character, ui, view }` |
| `POST` | `/api/training/action` | `{ character, ui, action }` | `{ character, ui, view, toast, jobRunning }` |
| `POST` | `/api/training/export` | `{ character }` | `{ character: SrdCharacter, label }` |

## Layout

- `types.ts` — character, UI, actions
- `catalog.ts` — loads JSON from `public/data`
- `actions.ts` — pure reducer (`applyTrainingAction`)
- `view.ts` — display DTOs for sheet / world / pending choices
- `toSrd.ts` — training character → maze `SrdCharacter`
- `abilities.ts` / `magic.ts` / `world.ts` / `origin.ts` — rules helpers
