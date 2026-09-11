# Training domain API

Rules for the character training loop live in `src/training/`. The React hub
(`TrainingClient` / `QuestClient`) renders view DTOs and posts actions.

## Surfaces

| Surface | Entry | Persistence / handoff |
|---------|-------|------------------------|
| Creation | `/` → `character-initialization.html` | Writes `mazeguild.character` (`CHARACTER_STORAGE_KEY` in `src/lib/characterStorage.ts`) |
| Training | `/training` Sheet + World | Reads/writes the same key via `characterStorage` |
| Quest | `/training` Quest tab | `POST /api/training/export` → `QuestClient` → `GameClient({ initialRecruit })` |

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET` | `/api/training/catalog` | — | Static counts / timing summary |
| `POST` | `/api/training/view` | `{ character, ui }` | `{ character, ui, view }` |
| `POST` | `/api/training/action` | `{ character, ui, action }` | `{ character, ui, view, toast, jobRunning }` |
| `POST` | `/api/training/export` | `{ character }` | `{ character: SrdCharacter, label }` — PLAYER for tavern hire |

Character state is still owned by the browser (`localStorage`) and sent on every
request. Later this can become a DB-backed character id without changing the UI.

## Layout

- `types.ts` — character, UI, actions
- `catalog.ts` — loads JSON from `public/data`
- `actions.ts` — pure reducer (`applyTrainingAction`)
- `view.ts` — display DTOs for sheet / world / pending choices (Quest has no view DTO)
- `toSrd.ts` — training character → maze `SrdCharacter`
- `abilities.ts` / `magic.ts` / `world.ts` / `origin.ts` — rules helpers

UI components: `src/components/training/TrainingClient.tsx` (hub),
`src/components/training/QuestClient.tsx` (export + GameClient).
