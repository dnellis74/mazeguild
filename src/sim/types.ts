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
  /** Assigned attack-roll cantrip name, e.g. "Fire Bolt". Omitted for weapon attacks. */
  cantrip?: string;
  lucky: boolean;
  relentless: boolean;
  relentlessUsed: boolean;
  sneakAttackDice: number;
  healSlots: number;
  layOnHands: number;
  spellMod: number;
  healDice: DiceExpr;
  xp: number;
  xpValue: number;
};

export type PartySnapshot = {
  name: string;
  class: string;
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
      /** Weapon or cantrip used for this attack. */
      used?: string;
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

/** Loose SRD 5.1 stat block as emitted by src/gen (and the old Python tool). */
export type SrdCharacter = {
  name?: string;
  class: string;
  race: string;
  subrace?: string | null;
  background?: string;
  alignment?: string;
  meta?: { source?: string; level?: number; note?: string };
  xp?: number;
  ability_scores: Record<string, { score: number; modifier?: string }>;
  proficiency_bonus: string | number;
  saving_throws?: Record<string, string>;
  saving_throw_proficiencies?: string[];
  skill_proficiencies?: string[];
  armor_proficiencies?: string[];
  weapon_proficiencies?: string[];
  tool_proficiencies?: string[];
  languages?: string[];
  hit_points: { value: number; hit_die?: string; note?: string | null };
  /** Raw hit-die rolls for levels after 1st. */
  hit_point_rolls?: number[];
  armor_class: { value: number; calculation?: string };
  speed?: string;
  racial_traits?: string[];
  draconic_ancestry?: {
    dragon: string;
    damage_type: string;
    breath_weapon: string;
  } | null;
  high_elf_bonus_cantrip?: string | null;
  tiefling_cantrip?: string | null;
  class_features_level_1?: string[];
  class_features?: string[];
  spellcasting?: {
    ability?: string;
    spell_save_dc?: number;
    spell_attack_bonus?: string;
    spell_slots?: Record<string, number>;
    spells_prepared?: string[];
    spells_known?: string[];
    cantrips_known?: string[];
    spellbook?: string[];
    spells_prepared_today?: string[];
    prepared_count_formula?: string;
  } | null;
  equipment?: {
    from_class?: string[];
    from_class_detail?: Array<{
      item: string;
      stats?: {
        type?: string;
        name?: string;
        damage?: string;
        properties?: string[];
      };
    }>;
    from_background?: string[];
  };
  background_feature?: { name: string; text: string };
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
