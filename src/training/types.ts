/** Shared training / character-creation types. Pure data — no DOM. */

export type Ability = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export const ABILITY_ORDER: Ability[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export const ABILITY_FULL_NAME: Record<Ability, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

export const ABILITY_SHORT_NAME: Record<string, Ability> = Object.fromEntries(
  Object.entries(ABILITY_FULL_NAME).map(([short, full]) => [full, short as Ability]),
) as Record<string, Ability>;

export type FeatureRef = string | string[];

export type Skill = {
  id: string;
  archetype: string;
  feature: FeatureRef;
  prerequisite?: string | null;
  detail?: string;
  description?: string;
  area: string;
  building: string;
  room: string;
  activity: string;
  fills?: number;
  fillMsSec?: number;
};

export type EarnedFeature = {
  id: string;
  feature: string[];
  archetype: string;
  detail?: string | null;
  description?: string | null;
  area?: string;
  building?: string;
  room?: string;
  activity?: string;
};

export type KnownCantrip = {
  id: number | string;
  name: string;
  archetype: string;
  description?: string;
};

export type KnownSpell = {
  id: number | string;
  name: string;
  archetype: string;
  level?: number;
  description?: string;
};

export type ActiveJob = {
  kind: "area" | "building" | "room" | "activity";
  area?: string;
  building?: string;
  room?: string;
  activity?: string;
  skillId?: string;
  feature?: FeatureRef;
  archetype?: string;
  detail?: string;
  fills: number;
  fillMsSec: number;
  durationMs: number;
  startedAt: number;
};

/**
 * Shared companion blob — Town Square, training, and maze quest all use this.
 * `id` / `displayName` live on the character (not a separate roster wrapper).
 */
export type Character = {
  id: string;
  displayName: string;
  raceId: string;
  subrace?: { subraceId: string; label: string } | null;
  alignment: {
    alignmentId: string;
    definingExperience?: {
      questionId?: string;
      scenario?: string;
      optionId?: string;
      label?: string;
    } | null;
  };
  featurePoints: number;
  features: EarnedFeature[];
  cantrips: KnownCantrip[];
  spells: KnownSpell[];
  abilityScores: Record<Ability, number>;
  abilityScoresAssigned: boolean;
  abilityPointsUnspent?: number;
  originStory?: string | null;
  unlocked: {
    areas: Record<string, boolean>;
    buildings: Record<string, boolean>;
    rooms: Record<string, boolean>;
  };
  activeJob: ActiveJob | null;
  /** Maze / adventure XP (optional; defaults to 0). */
  xp?: number;
};

export type TrainingUi = {
  hubTab: "sheet" | "world" | "quest";
  worldView: "areas" | "buildings" | "rooms" | "activities";
  worldArea: string | null;
  worldBuilding: string | null;
  worldRoom: string | null;
  pendingChoice: PendingChoice | null;
  originDraft?: string | null;
};

export type PendingChoice =
  | {
      type: "favored-enemy";
      options: string[];
      job: Omit<ActiveJob, "fills" | "fillMsSec" | "durationMs" | "startedAt"> & {
        fills?: number;
        fillMsSec?: number;
      };
    }
  | {
      type: "cantrip";
      archetype: string;
      remaining: number;
      allowance: number;
      owned: number;
      options: KnownCantrip[];
    }
  | {
      type: "spell";
      archetype: string;
      remaining: number;
      allowance: number;
      owned: number;
      options: KnownSpell[];
    };

export type TrainingAction =
  | { type: "hub-tab"; tab: TrainingUi["hubTab"] }
  | { type: "world-nav"; view: TrainingUi["worldView"] }
  | { type: "world-select-area"; area: string }
  | { type: "world-select-building"; building: string }
  | { type: "world-select-room"; room: string }
  | { type: "world-select-activity"; skillId: string }
  | { type: "world-select-portal"; portalId: string }
  | { type: "world-select-cantrip"; archetype: string }
  | { type: "world-select-spell"; archetype: string }
  | { type: "confirm-favored-enemy"; enemy: string }
  | { type: "confirm-cantrip"; cantripId: string | number }
  | { type: "confirm-spell"; spellId: string | number }
  | { type: "cancel-choice" }
  | { type: "tick-job" }
  | { type: "complete-job" }
  | { type: "save-origin-story"; text: string }
  | { type: "reset-origin-prompt" };

export type ActionResult = {
  character: Character;
  ui: TrainingUi;
  toast?: string | null;
  /** True when client should keep polling an active job. */
  jobRunning?: boolean;
  /** Client should navigate here (portal activities). */
  navigate?: string | null;
};
