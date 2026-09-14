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
       ├─ on win: XP + short rest (Hit Dice heal, Second Wind, Warlock slots)
       ├─ on wipe / exit / step cap: close the log
       └─ partyAfter: HP/XP (town return fully restores HP + Hit Dice)
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
| **Encounters** | `encounters.ts`, `encounterScaling.ts` | Monster packs by difficulty; `MONSTER_STATS.equipment` is `CharacterEquipment` |
| **World** | `maze.ts`, `rng.ts`, `leveling.ts` | Geometry, PRNG, XP→level |

**Rule of thumb:** tactics picks *what*; rules rolls *how*; combat wires them and mutates state.

## Combat turn shape

Structured to mirror the SRD 5.1 procedure (`combat.ts`):

```
determineSurprise()       // stub — no Stealth/Perception yet
establishPositions()      // stub — no geometry by design
loop:
  beginNextRound()        // round++ / end check
  rollInitiative()        // currently re-rolled each round (see note)
  takeTurns()             // beginTurn + bonus + action per actor
```

```
for each living actor in initiative order:
  beginTurn          // clear reactionUsed, tempAcBonus; expire conditions; death saves
  chooseBonusAction / chooseAction → Intent
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
**Only blinded, guided, and unconscious defenders grant advantage today** (blinded attacker → disadvantage; both cancel), plus Shocking Grasp’s `advantageVsMetalArmor` when the defender’s `wearingMetalArmor` is true. Unconscious also auto-crits melee hits — weapons with `ranged: false`, and attack cantrips/spells with catalog `ranged: false` (Shocking Grasp, Inflict Wounds). Ranged weapons / ranged spell attacks get advantage only.

### Damage traits

`immunities` / `resistances` / `vulnerabilities` (string arrays of damage types).  
Applied in `applyDamage(target, amount, damageType)` via `modifyDamageByTraits`: immunity → 0; resist+vuln cancel → normal; else resist halves (floor) or vuln doubles.  
**Rage:** Barbarians auto-enter at start of turn (`ragesRemaining` from leveling.json); while raging, resistance to bludgeoning/piercing/slashing. Ends on unconsciousness or end of encounter (simplified vs full SRD duration clock). No rage damage bonus / STR adv in this pass.

### Concentration + roll modifiers

- `concentratingOn: { spellName, startedRound, onEnd } | null` — one spell at a time; new cast ends the old (runs `onEnd`). Damage → CON save DC `max(10, floor(dmg/2))`; unconscious/death ends with no save.
- `rollModifiers[]` — `{ source, affects: attack|save|both, die, sign }`; same `source` replaces. Dice rolled fresh after the d20, in array order.
- **Bless** is the first consumer: buff up to 3 allies with +1d4 both, caster concentrates; teardown removes modifiers from all affected.

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

Combat classification fields on spells and cantrips (`combatType`, `damage`, `save`, `pool`, `condition`, `trigger`, `effect`, `ranged` on attack entries) drive which code path runs — paraphrased `description` text is not parsed.

## Tests

```bash
npx vitest run src/sim
```

Co-located `*.test.ts` files cover rules math, tactics policy, combat integration, maze, encounters, and full-run determinism.
