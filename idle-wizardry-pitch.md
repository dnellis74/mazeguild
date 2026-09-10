# One-Page Pitch: Character-Driven Idle Dungeon Crawler

## Elevator Pitch

A browser-based fantasy RPG where character creation is driven by narrative, not class selection. Players describe (or select) a character's race, alignment, and formative experience, and that background sets the character's tendencies rather than locking them into a fixed class. From there, the character grows through a classless, D&D SRD-flavored skill system: a divine caster can pick up thieving skills, a fighter can learn a little magic, and skill progression is capped in step with overall level so nothing can be rushed out of order.

Growth happens in two connected loops. At the training ground, players spend skill points, starting allocation plus points earned from questing, across SRD-derived skill tracks. At the tavern, players form parties with other characters and send them on quests: an idle-resolved loop in the vein of Godville, wrapped in the visual language of the classic Wizardry dungeon crawlers. The game runs on the SRD 5.1 ruleset (Creative Commons Attribution 4.0) for familiarity, but nothing about it requires players to know D&D to play.

## Core Pillars

- Narrative-driven origin: race, alignment, and background set tendencies, not class
- Classless skill system: SRD-flavored skill tracks (Defense, Attack, Divine, Arcane), cross-track learning allowed, level-gated to prevent skipping ahead
- Two connected idle loops: training ground (skill spend) and tavern (questing); point income from one feeds the other
- Wizardry-style presentation for quest/dungeon content, Godville-style resolution logic
- Existing scaffolding to build on: seeded maze generator, rules-legal SRD character generator, tavern hiring roster, encounter tables

## Milestone 1: Three Discrete Prototypes

Before wiring the full loop together, the first milestone is three standalone prototypes, each demonstrating one core mechanic in isolation.

1. **Narrative character creation.** Prove out the origin-to-tendency pipeline: race, alignment, and background in, a character with SRD-flavored default leanings out. The freeform-text vs. structured-picker question (Mount & Blade-style) gets resolved here, since it's a prerequisite for the mechanic, not a detail to defer.

2. **Training ground.** Prove the point-buy skill system: spend an initial allocation across skill tracks, confirm the level-gating rule holds (no jumping ahead on any single skill relative to overall level), and confirm the classless cross-track learning works as intended (a divine caster picking up thieving skills, for example).

3. **Tavern / questing.** Prove the idle quest-resolution loop: party formation, quest dispatch, and resolution, in Wizardry-styled presentation. This piece can reuse the most existing work (seeded maze generator, encounter tables), so it may be the fastest to stand up.

Each prototype is judged on its own mechanic, not on integration. Connecting the three into the full character-creation-to-questing loop is explicitly out of scope for this milestone, as are League Play, Campaign Persistence, and the Assistant Coach system, all of which stay on the roadmap for later.
