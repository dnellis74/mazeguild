# Training domain API

Rules for the character training loop live in `src/training/`. The HTML UI only
renders view DTOs and posts actions.

## Endpoints

| Method | Path | Body | Returns |
|--------|------|------|---------|
| `GET` | `/api/training/catalog` | — | Static counts / timing summary |
| `POST` | `/api/training/view` | `{ character, ui }` | `{ character, ui, view }` |
| `POST` | `/api/training/action` | `{ character, ui, action }` | `{ character, ui, view, toast, jobRunning }` |
| `POST` | `/api/training/export` | `{ character }` | `{ character: SrdCharacter, label }` — for tavern hire |

Character state is still owned by the browser (`localStorage`) and sent on every
request. Later this can become a DB-backed character id without changing the UI.

Quest → tavern: export stores the SRD blob in `sessionStorage` (`mazeguild.tavernRecruit`),
then opens `/`. `GameClient` merges that recruit into the tavern roster and pre-selects them.

## Layout

- `types.ts` — character, UI, actions
- `catalog.ts` — loads JSON from `public/data`
- `actions.ts` — pure reducer (`applyTrainingAction`)
- `view.ts` — display DTOs for sheet / world / pending choices
- `toSrd.ts` — training character → maze `SrdCharacter`
- `abilities.ts` / `magic.ts` / `world.ts` / `origin.ts` — rules helpers
