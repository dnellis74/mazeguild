export type Dir = "n" | "e" | "s" | "w";

export type Pos = { x: number; y: number };

export type Cell = { n: boolean; e: boolean; s: boolean; w: boolean };

export type Maze = {
  size: number;
  grid: Cell[][];
  entrance: Pos;
  exit: Pos;
};

export type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

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

export type Combatant = {
  id: string;
  name: string;
  kind: "pc" | "monster";
  className: string;
  race: string;
  role: Role;
  abilities: Record<Ability, number>;
  proficiencyBonus: number;
  ac: number;
  maxHp: number;
  hp: number;
  alive: boolean;
  weapon: Weapon;
  lucky: boolean;
  relentless: boolean;
  relentlessUsed: boolean;
  sneakAttackDice: number;
  healSlots: number;
  layOnHands: number;
  spellMod: number;
  healDice: DiceExpr;
  xpValue: number;
};

export type PartySnapshot = {
  name: string;
  class: string;
  race: string;
  hp: number;
  maxHp: number;
  ac: number;
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
    }
  | {
      event: "heal";
      round: number;
      actor: string;
      target: string;
      amount: number;
      targetHpAfter: number;
    }
  | { event: "death"; round: number; name: string }
  | {
      event: "encounter_won";
      xpGained: number;
      xpTotal: number;
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

/** Loose SRD 5.1 stat block as emitted by tools/srd_character_generator.py */
export type SrdCharacter = {
  name?: string;
  class: string;
  race: string;
  subrace?: string | null;
  meta?: { level?: number };
  ability_scores: Record<string, { score: number; modifier?: string }>;
  proficiency_bonus: string | number;
  hit_points: { value: number };
  armor_class: { value: number };
  racial_traits?: string[];
  class_features_level_1?: string[];
  spellcasting?: {
    ability?: string;
    spell_slots?: Record<string, number>;
    spells_prepared?: string[];
    spells_known?: string[];
    cantrips_known?: string[];
  } | null;
  equipment?: {
    from_class_detail?: Array<{
      item: string;
      stats?: {
        type?: string;
        name?: string;
        damage?: string;
        properties?: string[];
      };
    }>;
  };
};

export type DungeonInput = {
  seed: number;
  party: SrdCharacter[];
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
};
