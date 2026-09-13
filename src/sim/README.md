# Combat / dungeon sim

Headless, seeded simulation for maze runs and encounters. JSON in → JSON out. Same seed + party always yields byte-identical output.

## High-level flow

```
runDungeon(seed, party)
  │
  ├─ createRng(seed)          deterministic PRNG for the whole run
  ├─ generateMaze + aStarPath fixed route entrance → exit
  ├─ companionToCombatant     Character → Combatant (slots, spells, cantrips)
  │
  └─ walk the path
       ├─ every N steps (6d8): spawnEncounter → runCombat
       ├─ on wipe / exit / step cap: close the log
       └─ partyAfter: HP/XP to write back to companions
```

`run.ts` owns the dungeon loop. It never resolves attacks itself — that lives in combat + rules.

## Layering

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| **Orchestration** | `run.ts` | Maze walk, encounter timing, XP/loot, log assembly |
| **Adaptation** | `adapter.ts` | Map training `Character` → runtime `Combatant` |
| **Tactics** | `tactics.ts` | Pure intent selection (no dice, no HP mutation) |
| **Combat loop** | `combat.ts` | Rounds, initiative, spend slots, call rules, append log |
| **Rules** | `rules.ts` | Dice math: attacks, saves, heals, HP pools, conditions |
| **Data loaders** | `spells.ts`, `cantrips.ts`, `weapons.ts` | Catalog lookup + “is this castable?” helpers |
| **Encounters** | `encounters.ts`, `encounterScaling.ts` | Monster packs by difficulty |
| **World** | `maze.ts`, `rng.ts`, `leveling.ts` | Geometry, PRNG, XP→level |

**Rule of thumb:** tactics picks *what*; rules rolls *how*; combat wires them and mutates state.

## Combat turn shape

```
for each round:
  roll initiative for living actors
  for each actor in init order:
    beginTurn          // clear reactionUsed, tempAcBonus; expire conditions
    if unconscious → skip action
    chooseAction / chooseEnemyAction → Intent
    resolve intent:
      heal | control | save AoE | auto spell | attack (+ optional reaction)
```

There is **no position model** inside an encounter. “Area” spells hit every living foe (or rank by current HP for Sleep / Color Spray). Allies are never caught in PC AoEs — a deliberate RAW simplification.

## Spell categories

Eligibility always requires the spell on `ch.spells` (learned) plus remaining `spellSlots`. One shared 1st-level slot pool for offense, control, save AoE, and reactions.

| Kind | Examples | How it resolves |
|------|----------|-----------------|
| **auto** | Magic Missile | No attack roll; spend slot; roll damage |
| **control** (HP pool) | Sleep, Color Spray | Roll pool once; affect foes in ascending current HP until pool runs out |
| **save** (AoE) | Burning Hands, Thunderwave | One shared damage roll; each living foe saves independently |
| **reaction** | Shield | `before_damage` hook after a hit is known, before damage applies |
| **cantrip** | Fire Bolt, etc. | Attack roll via `resolveAttack` when assigned on the combatant |

Tactics priority (PCs):

1. Heal wounded ally (if heal resource)
2. Control spell if ≥2 living foes
3. AoE save spell if ≥2 living foes
4. Auto spell (e.g. Magic Missile)
5. Attack cantrip
6. Weapon

When both Sleep and Color Spray are known → prefer Sleep.  
When both Burning Hands and Thunderwave are known → prefer Burning Hands.

## Attack resolution seam

```
resolveAttack          // d20 (+ adv/disadv) vs AC → hit? + damage roll
    ↓ if hit
before_damage reaction // e.g. Shield: +5 AC, re-check; may cancel non-crit hit
    ↓ if still hit
applyDamage
    ↓
after_damage reaction  // hook exists; unused (future: Hellish Rebuke)
```

Crits are natural 20 and ignore AC — Shield cannot turn a crit into a miss.

### Advantage / disadvantage

Full attack-roll spine in `rules.ts` (`rollD20`, `resolveAdvantageMode`, `attackRollMode`).  
**Only blinded is wired today:** blinded attacker → disadvantage; attacks against blinded → advantage; both → cancel. Unconscious / prone / etc. are not sources yet.

### Saves

`spellSaveDC = 8 + proficiencyBonus + spellMod`.  
Save roll = `d20 + ability modifier` only — **no save proficiency** (Combatant has none). Known simplification.

AoE save RNG budget for *N* living foes:

- Burning Hands: `3` (3d6) + `N` save rolls  
- Thunderwave: `2` (2d8) + `N` save rolls  

Thunderwave’s 10-ft push is **logged** (`pushed: true`) but has no mechanical effect without positions.

## Conditions

`Combatant.condition: { name, expiresRound } | null`

| Condition | Set by | Cleared by |
|-----------|--------|------------|
| `unconscious` | Sleep | Damage, duration expiry (`expiresRound`), (shake-awake deferred) |
| `blinded` | Color Spray | Duration expiry |

Unconscious combatants still appear in initiative; `beginTurn` runs, then the action is skipped.

Shield’s +5 AC uses `tempAcBonus`, cleared at the start of that combatant’s next turn (same “used this round” pattern as `reactionUsed` / `relentlessUsed`).

## Determinism

- Single `createRng(seed)` stream for the whole dungeon run  
- Combat, encounters, cantrip picks, and loot all draw from it  
- `run.test.ts` asserts same seed + party → identical JSON  

Any new roll must consume the rng in a fixed order or determinism breaks.

## Key types

- `Combatant` — runtime fighter (`types.ts`)
- `Intent` / `ReactionIntent` — tactics output (`tactics.ts`)
- `LogEvent` — append-only replay log (`types.ts`)
- `DungeonInput` / `DungeonResult` — public API (`index.ts` re-exports)

## Data sources

| Runtime loader | JSON / tables |
|----------------|---------------|
| `spells.ts` | `public/data/spells_level1.json` |
| `cantrips.ts` | `public/data/cantrips.json` |
| `weapons.ts` | `src/data/weapons.json` |
| `encounterScaling.ts` | encounter tables under `src/data` / related |

Combat classification fields on spells (`combatType`, `damage`, `save`, `pool`, `condition`, `trigger`, `effect`) drive which code path runs — paraphrased `description` text is not parsed.

## Tests

```bash
npx vitest run src/sim
```

Co-located `*.test.ts` files cover rules math, tactics policy, combat integration, maze, encounters, and full-run determinism.
