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
export type ConditionName = "unconscious" | "blinded";

export type ActiveCondition = {
  name: ConditionName;
  /** Cleared when combat `round` reaches this value (beginTurn check). */
  expiresRound: number;
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
  weapon: Weapon;
  /** Assigned attack-roll cantrip name, e.g. "Fire Bolt". Omitted for weapon attacks. */
  cantrip?: string;
  /** Learned combat spell ready to cast when spellSlots remain, e.g. "Magic Missile". */
  spell?: string;
  /** Learned HP-pool control spell, e.g. "Sleep". */
  controlSpell?: string;
  /** Learned AoE save spell, e.g. "Burning Hands". */
  saveSpell?: string;
  /** Learned reaction spell, e.g. "Shield". */
  reactionSpell?: string;
  lucky: boolean;
  relentless: boolean;
  relentlessUsed: boolean;
  /** True after using a reaction; cleared at the start of this combatant's turn. */
  reactionUsed: boolean;
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
  sneakAttackDice: number;
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
