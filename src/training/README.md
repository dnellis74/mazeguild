# Training domain API

Rules for the character training loop live in `src/training/`. The HTML UI only
renders view DTOs and posts actions.

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET` | `/api/training/catalog` | — | Static counts / timing summary |
| `POST` | `/api/training/view` | `{ character, ui }` | `{ character, ui, view }` |
| `POST` | `/api/training/action` | `{ character, ui, action }` | `{ character, ui, view, toast, jobRunning }` |

Character state is still owned by the browser (`localStorage`) and sent on every
request. Later this can become a DB-backed character id without changing the UI.

## Layout

- `types.ts` — character, UI, actions
- `catalog.ts` — loads JSON from `public/data`
- `actions.ts` — pure reducer (`applyTrainingAction`)
- `view.ts` — display DTOs for sheet / world / pending choices
- `abilities.ts` / `magic.ts` / `world.ts` / `origin.ts` — rules helpers
