export type Dir = "n" | "e" | "s" | "w";

export type Pos = { x: number; y: number };

export type Cell = { n: boolean; e: boolean; s: boolean; w: boolean };

export type Maze = {
  size: number;
  grid: Cell[][];
  entrance: Pos;
  exit: Pos;
};

export type Ability = import("@/lib/abilities").Ability;

export type DiceExpr = { count: number; sides: number };

export type Weapon = {
  name: string;
  damage: DiceExpr;
  damageType: string;
  properties: string[];
  finesse: boolean;
  ranged: boolean;
};

export type Role = "tank" | "healer" | "dps";

/** Timed combat conditions (Sleep, future Color Spray, etc.). */
export type ConditionName = "unconscious" | "blinded" | "guided";

export type ActiveCondition = {
  name: ConditionName;
  /** Cleared when combat `round` reaches this value (beginTurn check). */
  expiresRound: number;
};

/** Active concentration spell; onEnd tears down effects (e.g. Bless modifiers). */
export type ConcentrationState = {
  spellName: string;
  startedRound: number;
  onEnd: () => void;
};

/**
 * Live die bonus/penalty on attack rolls and/or saves.
 * Rolled fresh each time; same `source` replaces rather than stacks.
 */
export type RollModifier = {
  source: string;
  affects: "attack" | "save" | "both";
  die: DiceExpr;
  sign: 1 | -1;
};

export type Combatant = {
  id: string;
  name: string;
  kind: "pc" | "monster";
  /** Primary feature archetype label (or "Monster"). Not a class sheet. */
  archetype: string;
  race: string;
  role: Role;
  abilities: Record<Ability, number>;
  proficiencyBonus: number;
  ac: number;
  maxHp: number;
  hp: number;
  alive: boolean;
  /**
   * True when wearing metal armor (chain, scale, plate, etc. — not leather/hide).
   * Used by Shocking Grasp's advantageVsMetalArmor.
   */
  wearingMetalArmor: boolean;
  /** Temporary hit points (absorbed before real HP; do not stack). */
  tempHp: number;
  /** Death saving throw successes while at 0 HP (PCs only). */
  deathSaveSuccesses: number;
  /** Death saving throw failures while at 0 HP (PCs only). */
  deathSaveFailures: number;
  /** Stable at 0 HP (no death saves until damaged or healed). */
  stable: boolean;
  weapon: Weapon;
  /** Assigned attack-roll cantrip name, e.g. "Fire Bolt". Omitted for weapon attacks. */
  cantrip?: string;
  /** Learned stabilize cantrip, e.g. "Spare the Dying". */
  stabilizeCantrip?: string;
  /** Learned combat spell ready to cast when spellSlots remain, e.g. "Magic Missile". */
  spell?: string;
  /** Learned leveled spell attack, e.g. "Guiding Bolt" / "Inflict Wounds". */
  attackSpell?: string;
  /** Learned HP-pool control spell, e.g. "Sleep". */
  controlSpell?: string;
  /** Learned AoE save spell, e.g. "Burning Hands". */
  saveSpell?: string;
  /** Learned buff/concentration spell, e.g. "Bless". */
  buffSpell?: string;
  /** Reaction spell, e.g. "Shield". */
  reactionSpell?: string;
  /** Preferred heal spell name ("Cure Wounds"). */
  healSpell?: string;
  /** Bonus-action heal spell ("Healing Word"). */
  bonusHealSpell?: string;
  /** Fighting styles earned (exact SRD names). At most one expected. */
  fightingStyles: string[];
  /** Archery: +2 on ranged weapon attack rolls. */
  archery: boolean;
  /** Great Weapon Fighting: reroll 1–2 on qualifying melee damage dice. */
  greatWeaponFighting: boolean;
  /** Second Wind available (once per short rest; rests after each encounter). */
  secondWindAvailable: boolean;
  /** Fighter level contribution to Second Wind (1d10 + level). */
  secondWindLevel: number;
  /** Hit Dice pool total (one per level). */
  hitDiceTotal: number;
  /** Hit Dice remaining to spend on short rests. */
  hitDiceRemaining: number;
  /** Hit die size for this combatant (e.g. 10 for Fighter). */
  hitDieSides: number;
  lucky: boolean;
  relentless: boolean;
  relentlessUsed: boolean;
  /** True after using a reaction; cleared at the start of this combatant's turn. */
  reactionUsed: boolean;
  /**
   * True after Sneak Attack damage is applied this turn; cleared at turn start.
   * Defensive vs future Extra Attack — no multi-attack path exists yet.
   */
  sneakAttackUsedThisTurn: boolean;
  /** Temporary AC from Shield until the start of this combatant's next turn. */
  tempAcBonus: number;
  /** Active condition, if any (one at a time for this pass). */
  condition: ActiveCondition | null;
  /**
   * Creature type for spell exclusions (e.g. Sleep vs undead).
   * Omitted / "humanoid" for typical goblinoids and PCs.
   */
  creatureType?: string;
  /** Damage types that deal 0 damage (distinct from resistance halving). */
  immunities: string[];
  /** Damage types halved (floor) after other modifiers. */
  resistances: string[];
  /** Damage types doubled after other modifiers. */
  vulnerabilities: string[];
  /** Barbarian Rage active this encounter. */
  raging: boolean;
  /** Remaining Rage uses (from leveling table; 0 for non-Barbarians). */
  ragesRemaining: number;
  /** Flat damage added to Strength melee weapon hits while raging (Rage Damage column). */
  rageDamage: number;
  /**
   * Attacked a hostile or took damage since the start of this combatant's last turn.
   * Cleared at turn start after the early-end check; set by combat/applyDamage.
   */
  rageMaintained: boolean;
  /** Round when 1-minute Rage expires (beginTurn clears if round >= this). */
  rageExpiresRound: number | null;
  /** Current concentration spell, if any. */
  concentratingOn: ConcentrationState | null;
  /** Active roll modifiers (Bless, future Bane, etc.). */
  rollModifiers: RollModifier[];
  sneakAttackDice: number;
  /**
   * Bugbear Brute: on a melee weapon hit, roll one extra die of the weapon's
   * damage (e.g. morningstar 1d8 → 2d8). Included in the attack; doubles on crit.
   */
  brute: boolean;
  healSlots: number;
  layOnHands: number;
  /** Remaining 1st-level spell slots (offense). Separate from healSlots. */
  spellSlots: number;
  spellMod: number;
  healDice: DiceExpr;
  xp: number;
  xpValue: number;
};

export type PartySnapshot = {
  name: string;
  /** Feature archetypes summary for the roster UI. */
  summary: string;
  race: string;
  hp: number;
  maxHp: number;
  ac: number;
  xp: number;
};

export type LogEvent =
  | {
      event: "run_start";
      seed: number;
      entrance: Pos;
      exit: Pos;
      firstEncounterIn: number;
      party: PartySnapshot[];
    }
  | { event: "step"; n: number; from: Pos; to: Pos; facing: Dir }
  | { event: "encounter_start"; pos: Pos; step: number; enemies: string[] }
  | {
      event: "round_start";
      round: number;
      /** Combatant names in initiative order (highest first). */
      order: string[];
    }
  | {
      event: "attack";
      round: number;
      actor: string;
      target: string;
      hit: boolean;
      crit?: boolean;
      damage?: number;
      targetHpAfter?: number;
      /** Weapon, cantrip, or spell used for this attack. */
      used?: string;
      /** Reaction that altered this attack, e.g. "Shield". */
      reaction?: string;
      /**
       * Net attack-roll advantage/disadvantage (omitted when neither, or for
       * auto-hit spells with no attack roll).
       */
      advantageMode?: "advantage" | "disadvantage";
    }
  | {
      event: "heal";
      round: number;
      actor: string;
      target: string;
      amount: number;
      targetHpAfter: number;
      /** Cure Wounds, Lay on Hands, etc. */
      used?: string;
    }
  | {
      event: "control";
      round: number;
      actor: string;
      used: string;
      pool: number;
      /** Names of creatures fully covered by the HP pool. */
      affected: string[];
    }
  | {
      event: "save";
      round: number;
      actor: string;
      target: string;
      used: string;
      dc: number;
      d20: number;
      total: number;
      success: boolean;
      /** Shared full damage before save reduction. */
      damageFull: number;
      /** Damage applied after save (full or half). */
      damage: number;
      targetHpAfter: number;
      /** Thunderwave: failed save pushes 10 ft (logged only; no positions). */
      pushed?: boolean;
    }
  | {
      event: "buff";
      round: number;
      actor: string;
      used: string;
      /** Names of creatures that received the buff. */
      affected: string[];
    }
  | {
      event: "rage";
      round: number;
      actor: string;
      /** "Rage" on enter, "End Rage" on voluntary or logged ends. */
      used: "Rage" | "End Rage";
    }
  | {
      event: "death_save";
      round: number;
      actor: string;
      d20: number;
      outcome: "success" | "failure" | "revived" | "stabilized" | "died";
      successes: number;
      failures: number;
    }
  | {
      event: "stabilize";
      round: number;
      actor: string;
      target: string;
      used: string;
      targetHpAfter: number;
    }
  | { event: "death"; round: number; name: string }
  | {
      event: "xp_gain";
      name: string;
      amount: number;
      xpAfter: number;
    }
  | {
      event: "encounter_won";
      xpGained: number;
      loot: string;
    }
  | {
      event: "short_rest";
      heals: Array<{
        name: string;
        amount: number;
        hpAfter: number;
        hitDiceSpent: number;
        hitDiceRemaining: number;
      }>;
      secondWindRestored: string[];
      warlockSlotsRestored: string[];
    }
  | { event: "next_encounter_in"; steps: number }
  | { event: "exit_reached"; steps: number; pos: Pos }
  | { event: "wipe"; steps: number; pos: Pos }
  | { event: "aborted_step_cap"; steps: number }
  | { event: "resurrections_owed"; names: string[] }
  | {
      event: "run_end";
      score: number;
      stepsTaken: number;
      survivors: string[];
    };

/** Maze party is companions from Town Square / training — same blob. */
export type DungeonInput = {
  seed: number;
  party: import("@/training/types").Character[];
};

export type DungeonResult = {
  seed: number;
  maze: {
    size: number;
    grid: Cell[][];
    entrance: Pos;
    exit: Pos;
  };
  log: LogEvent[];
  /**
   * Human-readable lines shown in the EventLog UI (same strings as
   * `describeEvent` for narrative events). Included so downloads / API JSON
   * are readable without a renderer.
   */
  narrative: string[];
  score: number;
  stepsTaken: number;
  cellsVisited: number;
  visited: string[];
  /** Final combatant XP/HP to write back onto companions in the roster. */
  partyAfter: Array<{
    id: string;
    name: string;
    xp: number;
    hp: number;
    maxHp: number;
  }>;
};
