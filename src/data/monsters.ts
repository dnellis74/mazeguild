import type { CharacterEquipment } from "@/training/types";

/**
 * Monster blueprint. `equipment` uses the same slot ids as PC
 * `CharacterEquipment` (`armor` / `mainHand` / `offHand` / `pack`); omitted
 * slots are treated as empty at spawn. Combat weapon, AC, and
 * wearingMetalArmor are derived from equipment (not a separate weapons table).
 */
export type MonsterBlueprint = {
  /** Display name when it differs from the MONSTER_STATS key. */
  name?: string;
  size: "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan";
  type:
    | "Aberration"
    | "Beast"
    | "Celestial"
    | "Construct"
    | "Dragon"
    | "Elemental"
    | "Fey"
    | "Fiend"
    | "Giant"
    | "Humanoid"
    | "Monstrosity"
    | "Ooze"
    | "Plant"
    | "Undead";
  tags?: string[];
  /** SRD alignment string (includes Unaligned / Any … variants). */
  alignment: string;
  ac: number;
  hp: number;
  speed: number;
  abilities: Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", number>;
  skills?: string[];
  senses?: string[];
  languages?: string[];
  challengeRating: number;
  xpValue: number;
  /** Named traits (e.g. Bugbear "Brute"). */
  features?: string[];
  /** Partial loadout; missing slots are null at spawn. */
  equipment?: Partial<CharacterEquipment>;
};

export const MONSTER_STATS: Record<string, MonsterBlueprint> = {
    Commoner: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 10,
      hp: 4, // 4 (1d8)
      speed: 30,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      senses: ["passive Perception 10"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0,
      xpValue: 10,
      features: [],
      equipment: {
        mainHand: "club",
      },
    },
    Homunculus: {
      size: "Tiny",
      type: "Construct",
      tags: [],
      alignment: "Neutral",
      ac: 13, // natural armor
      hp: 5, // 5 (2d4)
      speed: 20,  // also fly 40 ft.
      abilities: { STR: 4, DEX: 15, CON: 11, INT: 10, WIS: 10, CHA: 7 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["understands the languages of its creator but can’t speak"],
      challengeRating: 0,
      xpValue: 10,
      features: ["Telepathic Bond"],
      // actions: Bite (poison)
      // immune: poison
      // condition immune: charmed, poisoned
      equipment: {
        armor: "natural_armor",
      },
    },
    Lemure: {
      size: "Medium",
      type: "Fiend",
      tags: ["devil"],
      alignment: "Lawful Evil",
      ac: 7,
      hp: 13, // 13 (3d8)
      speed: 15,
      abilities: { STR: 10, DEX: 5, CON: 11, INT: 1, WIS: 11, CHA: 3 },
      senses: ["darkvision 120 ft.", "passive Perception 10"],
      languages: ["understands Infernal but can’t speak"],
      challengeRating: 0,
      xpValue: 10,
      features: ["Devil’s Sight", "Hellish Rejuvenation"],
      // actions: Fist
      // resist: cold
      // immune: fire, poison
      // condition immune: charmed, frightened, poisoned
    },
    Shrieker: {
      size: "Medium",
      type: "Plant",
      tags: [],
      alignment: "Unaligned",
      ac: 5,
      hp: 13, // 13 (3d8)
      speed: 0,
      abilities: { STR: 1, DEX: 1, CON: 10, INT: 1, WIS: 3, CHA: 1 },
      senses: ["blindsight 30 ft. (blind beyond this radius)", "passive Perception 6"],
      languages: [],
      challengeRating: 0,
      xpValue: 10,
      features: ["False Appearance"],
      // actions: none; Shriek (reaction)
      // condition immune: blinded, deafened, frightened
    },
    Bandit: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Non-Lawful",
      ac: 12, // leather armor
      hp: 11, // 11 (2d8 + 2)
      speed: 30,
      abilities: { STR: 11, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
      senses: ["passive Perception 10"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0.125,
      xpValue: 25,
      features: [],
      equipment: {
        armor: "leather",
        mainHand: "scimitar",
        pack: { name: "Carried", contents: ["light_crossbow"] },
      },
    },
    Cultist: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Non-Good Alignment",
      ac: 12, // leather armor
      hp: 9, // 9 (2d8)
      speed: 30,
      abilities: { STR: 11, DEX: 12, CON: 10, INT: 10, WIS: 11, CHA: 10 },
      skills: ["deception +2", "religion +2"],
      senses: ["passive Perception 10"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0.125,
      xpValue: 25,
      features: ["Dark Devotion"],
      equipment: {
        armor: "leather",
        mainHand: "scimitar",
      },
    },
    Guard: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 16, // chain shirt, shield
      hp: 11, // 11 (2d8 + 2)
      speed: 30,
      abilities: { STR: 13, DEX: 12, CON: 12, INT: 10, WIS: 11, CHA: 10 },
      skills: ["perception +2"],
      senses: ["passive Perception 12"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0.125,
      xpValue: 25,
      features: [],
      equipment: {
        armor: "chain_shirt",
        mainHand: "spear",
        offHand: "shield",
      },
    },
    Kobold: {
      size: "Small",
      type: "Humanoid",
      tags: ["kobold"],
      alignment: "Lawful Evil",
      ac: 12,
      hp: 5, // 5 (2d6 − 2)
      speed: 30,
      abilities: { STR: 7, DEX: 15, CON: 9, INT: 8, WIS: 7, CHA: 8 },
      senses: ["darkvision 60 ft.", "passive Perception 8"],
      languages: ["Common", "Draconic"],
      challengeRating: 0.125,
      xpValue: 25,
      features: ["Sunlight Sensitivity", "Pack Tactics"],
      equipment: {
        mainHand: "dagger",
        pack: { name: "Carried", contents: ["sling"] },
      },
    },
    Merfolk: {
      size: "Medium",
      type: "Humanoid",
      tags: ["merfolk"],
      alignment: "Neutral",
      ac: 11,
      hp: 11, // 11 (2d8 + 2)
      speed: 10,  // also swim 40 ft.
      abilities: { STR: 10, DEX: 13, CON: 12, INT: 11, WIS: 11, CHA: 12 },
      skills: ["perception +2"],
      senses: ["passive Perception 12"],
      languages: ["Aquan", "Common"],
      challengeRating: 0.125,
      xpValue: 25,
      features: ["Amphibious"],
      equipment: {
        mainHand: "spear",
      },
    },
    Noble: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 15, // breastplate
      hp: 9, // 9 (2d8)
      speed: 30,
      abilities: { STR: 11, DEX: 12, CON: 11, INT: 12, WIS: 14, CHA: 16 },
      skills: ["deception +5", "insight +4", "persuasion +5"],
      senses: ["passive Perception 12"],
      languages: ["any two languages"],
      challengeRating: 0.125,
      xpValue: 25,
      features: [],
      // actions: Rapier; Parry (reaction)
      equipment: {
        armor: "breastplate",
        mainHand: "rapier",
      },
    },
    Stirge: {
      size: "Tiny",
      type: "Beast",
      tags: [],
      alignment: "Unaligned",
      ac: 14, // natural armor
      hp: 2, // 2 (1d4)
      speed: 10,  // also fly 40 ft.
      abilities: { STR: 4, DEX: 16, CON: 11, INT: 2, WIS: 8, CHA: 6 },
      senses: ["darkvision 60 ft.", "passive Perception 9"],
      languages: [],
      challengeRating: 0.125,
      xpValue: 25,
      features: [],
      // actions: Blood Drain
      equipment: {
        armor: "natural_armor",
      },
    },
    TribalWarrior: {
      name: "Tribal Warrior",
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 12, // hide armor
      hp: 11, // 11 (2d8 + 2)
      speed: 30,
      abilities: { STR: 13, DEX: 11, CON: 12, INT: 8, WIS: 11, CHA: 8 },
      senses: ["passive Perception 10"],
      languages: ["any one language"],
      challengeRating: 0.125,
      xpValue: 25,
      features: ["Pack Tactics"],
      equipment: {
        armor: "hide",
        mainHand: "spear",
      },
    },
    Acolyte: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 10,
      hp: 9, // 9 (2d8)
      speed: 30,
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 14, CHA: 11 },
      skills: ["medicine +4", "religion +2"],
      senses: ["passive Perception 12"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Spellcasting"],
      // actions: Club; Spellcasting (1st-level cleric)
      equipment: {
        mainHand: "club",
      },
    },
    Dretch: {
      size: "Small",
      type: "Fiend",
      tags: ["demon"],
      alignment: "Chaotic Evil",
      ac: 11, // natural armor
      hp: 18, // 18 (4d6 + 4)
      speed: 20,
      abilities: { STR: 11, DEX: 11, CON: 12, INT: 5, WIS: 8, CHA: 3 },
      senses: ["darkvision 60 ft.", "passive Perception 9"],
      languages: ["Abyssal", "telepathy 60 ft. (works only with creatures that understand Abyssal)"],
      challengeRating: 0.25,
      xpValue: 50,
      features: [],
      // actions: Multiattack, Bite, Claws, Fetid Cloud (1/day aura)
      // resist: cold, fire, lightning
      // immune: poison
      // condition immune: poisoned
      equipment: {
        armor: "natural_armor",
      },
    },
    Drow: {
      name: "Elf, Drow",
      size: "Medium",
      type: "Humanoid",
      tags: ["elf"],
      alignment: "Neutral Evil",
      ac: 15, // chain shirt
      hp: 13, // 13 (3d8)
      speed: 30,
      abilities: { STR: 10, DEX: 14, CON: 10, INT: 11, WIS: 11, CHA: 12 },
      skills: ["perception +2", "stealth +4"],
      senses: ["darkvision 120 ft.", "passive Perception 12"],
      languages: ["Elvish", "Undercommon"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Fey Ancestry", "Innate Spellcasting", "Sunlight Sensitivity"],
      // actions: Shortsword, Hand Crossbow (poison)
      equipment: {
        armor: "chain_shirt",
        mainHand: "shortsword",
        pack: { name: "Carried", contents: ["hand_crossbow"] },
      },
    },
    FlyingSword: {
      name: "Flying Sword",
      size: "Small",
      type: "Construct",
      tags: [],
      alignment: "Unaligned",
      ac: 17, // natural armor
      hp: 17, // 17 (5d6)
      speed: 0,  // also fly 50 ft. (hover)
      abilities: { STR: 12, DEX: 15, CON: 11, INT: 1, WIS: 5, CHA: 1 },
      senses: ["blindsight 60 ft. (blind beyond this radius)", "passive Perception 7"],
      languages: [],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Antimagic Susceptibility", "False Appearance"],
      // actions: Longsword (animated)
      // immune: poison, psychic
      // condition immune: blinded, charmed, deafened, frightened, paralyzed, petrified, poisoned
      // saving throws: Dex +4
      equipment: {
        armor: "natural_armor",
        mainHand: "longsword",
      },
    },
    Goblin: {
      size: "Small",
      type: "Humanoid",
      tags: ["goblinoid"],
      alignment: "Neutral Evil",
      ac: 15, // leather armor, shield
      hp: 7, // 7 (2d6)
      speed: 30,
      abilities: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
      skills: ["stealth +6"],
      senses: ["darkvision 60 ft.", "passive Perception 9"],
      languages: ["Common", "Goblin"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Nimble Escape"],
      equipment: {
        armor: "leather",
        mainHand: "scimitar",
        offHand: "shield",
        pack: { name: "Carried", contents: ["shortbow"] },
      },
    },
    Grimlock: {
      size: "Medium",
      type: "Humanoid",
      tags: ["grimlock"],
      alignment: "Neutral Evil",
      ac: 11,
      hp: 11, // 11 (2d8 + 2)
      speed: 30,
      abilities: { STR: 16, DEX: 12, CON: 12, INT: 9, WIS: 8, CHA: 6 },
      skills: ["athletics +5", "perception +3", "stealth +3"],
      senses: ["blindsight 30 ft. or 10 ft. while deafened (blind beyond this radius)", "passive Perception 13"],
      languages: ["Undercommon"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Blind Senses", "Keen Hearing and Smell", "Stone Camouflage"],
      // actions: Spiked Bone Club
      // condition immune: blinded
      equipment: {
        mainHand: "spiked_bone_club",
      },
    },
    Pseudodragon: {
      size: "Tiny",
      type: "Dragon",
      tags: [],
      alignment: "Neutral Good",
      ac: 13, // natural armor
      hp: 7, // 7 (2d4 + 2)
      speed: 15,  // also fly 60 ft.
      abilities: { STR: 6, DEX: 15, CON: 13, INT: 10, WIS: 12, CHA: 10 },
      skills: ["perception +3", "stealth +4"],
      senses: ["blindsight 10 ft.", "darkvision 60 ft.", "passive Perception 13"],
      languages: ["understands Common and Draconic but can’t speak"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Keen Senses", "Magic Resistance", "Limited Telepathy"],
      // actions: Bite, Sting (poison)
      equipment: {
        armor: "natural_armor",
      },
    },
    Skeleton: {
      size: "Medium",
      type: "Undead",
      tags: [],
      alignment: "Lawful Evil",
      ac: 13, // armor scraps
      hp: 13, // 13 (2d8 + 4)
      speed: 30,
      abilities: { STR: 10, DEX: 14, CON: 15, INT: 6, WIS: 8, CHA: 5 },
      senses: ["darkvision 60 ft.", "passive Perception 9"],
      languages: ["understands all languages it knew in life but can’t speak"],
      challengeRating: 0.25,
      xpValue: 50,
      features: [],
      // vulnerable: bludgeoning
      // immune: poison
      // condition immune: exhaustion, poisoned
      equipment: {
        armor: "armor_scraps",
        mainHand: "shortsword",
        pack: { name: "Carried", contents: ["shortbow"] },
      },
    },
    Sprite: {
      size: "Tiny",
      type: "Fey",
      tags: [],
      alignment: "Neutral Good",
      ac: 15, // leather armor
      hp: 2, // 2 (1d4)
      speed: 10,  // also fly 40 ft.
      abilities: { STR: 3, DEX: 18, CON: 10, INT: 14, WIS: 13, CHA: 11 },
      skills: ["perception +3", "stealth +8"],
      senses: ["passive Perception 13"],
      languages: ["Common", "Elvish", "Sylvan"],
      challengeRating: 0.25,
      xpValue: 50,
      features: [],
      // actions: Longsword, Shortbow (poison), Heart Sight, Invisibility
      equipment: {
        armor: "leather",
        mainHand: "longsword",
        pack: { name: "Carried", contents: ["shortbow"] },
      },
    },
    SteamMephit: {
      name: "Steam Mephit",
      size: "Small",
      type: "Elemental",
      tags: [],
      alignment: "Neutral Evil",
      ac: 10,
      hp: 21, // 21 (6d6)
      speed: 30,  // also fly 30 ft.
      abilities: { STR: 5, DEX: 11, CON: 10, INT: 11, WIS: 10, CHA: 12 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Aquan", "Ignan"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Death Burst", "Innate Spellcasting (1/Day)"],
      // actions: Claws, Steam Breath (Recharge 6)
      // immune: fire, poison
      // condition immune: poisoned
    },
    VioletFungus: {
      name: "Violet Fungus",
      size: "Medium",
      type: "Plant",
      tags: [],
      alignment: "Unaligned",
      ac: 5,
      hp: 18, // 18 (4d8)
      speed: 5,
      abilities: { STR: 3, DEX: 1, CON: 10, INT: 1, WIS: 3, CHA: 1 },
      senses: ["blindsight 30 ft. (blind beyond this radius)", "passive Perception 6"],
      languages: [],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["False Appearance"],
      // actions: Multiattack, Rotting Touch
      // condition immune: blinded, deafened, frightened
    },
    Zombie: {
      size: "Medium",
      type: "Undead",
      tags: [],
      alignment: "Neutral Evil",
      ac: 8,
      hp: 22, // 22 (3d8 + 9)
      speed: 20,
      abilities: { STR: 13, DEX: 6, CON: 16, INT: 3, WIS: 6, CHA: 5 },
      senses: ["darkvision 60 ft.", "passive Perception 8"],
      languages: ["understands the languages it knew in life but can’t speak"],
      challengeRating: 0.25,
      xpValue: 50,
      features: ["Undead Fortitude"],
      // actions: Slam
      // immune: poison
      // condition immune: poisoned
      // saving throws: Wis +0
    },
    Cockatrice: {
      size: "Small",
      type: "Monstrosity",
      tags: [],
      alignment: "Unaligned",
      ac: 11,
      hp: 27, // 27 (6d6 + 6)
      speed: 20,  // also fly 40 ft.
      abilities: { STR: 6, DEX: 12, CON: 12, INT: 2, WIS: 13, CHA: 5 },
      senses: ["darkvision 60 ft.", "passive Perception 11"],
      languages: [],
      challengeRating: 0.5,
      xpValue: 100,
      features: [],
      // actions: Bite (petrification)
    },
    Darkmantle: {
      size: "Small",
      type: "Monstrosity",
      tags: [],
      alignment: "Unaligned",
      ac: 11,
      hp: 22, // 22 (5d6 + 5)
      speed: 10,  // also fly 30 ft.
      abilities: { STR: 16, DEX: 12, CON: 13, INT: 2, WIS: 10, CHA: 5 },
      skills: ["stealth +3"],
      senses: ["blindsight 60 ft.", "passive Perception 10"],
      languages: [],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Echolocation", "False Appearance"],
      // actions: Crush (grapple + blind)
    },
    DustMephit: {
      name: "Dust Mephit",
      size: "Small",
      type: "Elemental",
      tags: [],
      alignment: "Neutral Evil",
      ac: 12,
      hp: 17, // 17 (5d6)
      speed: 30,  // also fly 30 ft.
      abilities: { STR: 5, DEX: 14, CON: 10, INT: 9, WIS: 11, CHA: 10 },
      skills: ["perception +2", "stealth +4"],
      senses: ["darkvision 60 ft.", "passive Perception 12"],
      languages: ["Auran", "Terran"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Death Burst", "Innate Spellcasting (1/Day)"],
      // actions: Claws, Blinding Breath (Recharge 6)
      // vulnerable: fire
      // immune: poison
      // condition immune: poisoned
    },
    Gnoll: {
      size: "Medium",
      type: "Humanoid",
      tags: ["gnoll"],
      alignment: "Chaotic Evil",
      ac: 15, // hide armor, shield
      hp: 22, // 22 (5d8)
      speed: 30,
      abilities: { STR: 14, DEX: 12, CON: 11, INT: 6, WIS: 10, CHA: 7 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Gnoll"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Rampage"],
      // actions: Bite, Spear, Longbow
      equipment: {
        armor: "hide",
        mainHand: "spear",
        offHand: "shield",
        pack: { name: "Carried", contents: ["longbow"] },
      },
    },
    DeepGnome: {
      name: "Gnome, Deep (Svirfneblin)",
      size: "Small",
      type: "Humanoid",
      tags: ["gnome"],
      alignment: "Neutral Good",
      ac: 15, // chain shirt
      hp: 16, // 16 (3d6 + 6)
      speed: 20,
      abilities: { STR: 15, DEX: 14, CON: 14, INT: 12, WIS: 10, CHA: 9 },
      skills: ["investigation +3", "perception +2", "stealth +4"],
      senses: ["darkvision 120 ft.", "passive Perception 12"],
      languages: ["Gnomish", "Terran", "Undercommon"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Stone Camouflage", "Gnome Cunning", "Innate Spellcasting"],
      // actions: War Pick, Poisoned Dart
      equipment: {
        armor: "chain_shirt",
        mainHand: "war_pick",
        pack: { name: "Carried", contents: ["poisoned_dart"] },
      },
    },
    GrayOoze: {
      name: "Gray Ooze",
      size: "Medium",
      type: "Ooze",
      tags: [],
      alignment: "Unaligned",
      ac: 8,
      hp: 22, // 22 (3d8 + 9)
      speed: 10,  // also climb 10 ft.
      abilities: { STR: 12, DEX: 6, CON: 16, INT: 1, WIS: 6, CHA: 2 },
      skills: ["stealth +2"],
      senses: ["blindsight 60 ft. (blind beyond this radius)", "passive Perception 8"],
      languages: [],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Amorphous", "Corrode Metal", "False Appearance"],
      // actions: Pseudopod (acid)
      // resist: acid, cold, fire
      // condition immune: blinded, charmed, deafened, exhaustion, frightened, prone
    },
    Hobgoblin: {
      size: "Medium",
      type: "Humanoid",
      tags: ["goblinoid"],
      alignment: "Lawful Evil",
      ac: 18, // chain mail, shield
      hp: 11, // 11 (2d8 + 2)
      speed: 30,
      abilities: { STR: 13, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 9 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Common", "Goblin"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Martial Advantage"],
      equipment: {
        armor: "chain_mail",
        mainHand: "longsword",
        offHand: "shield",
        pack: { name: "Carried", contents: ["longbow"] },
      },
    },
    IceMephit: {
      name: "Ice Mephit",
      size: "Small",
      type: "Elemental",
      tags: [],
      alignment: "Neutral Evil",
      ac: 11,
      hp: 21, // 21 (6d6)
      speed: 30,  // also fly 30 ft.
      abilities: { STR: 7, DEX: 13, CON: 10, INT: 9, WIS: 11, CHA: 12 },
      skills: ["perception +2", "stealth +3"],
      senses: ["darkvision 60 ft.", "passive Perception 12"],
      languages: ["Aquan", "Auran"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Death Burst", "False Appearance", "Innate Spellcasting (1/Day)"],
      // actions: Claws, Frost Breath (Recharge 6)
      // vulnerable: bludgeoning, fire
      // immune: cold, poison
      // condition immune: poisoned
    },
    Lizardfolk: {
      size: "Medium",
      type: "Humanoid",
      tags: ["lizardfolk"],
      alignment: "Neutral",
      ac: 15, // natural armor, shield
      hp: 22, // 22 (4d8 + 4)
      speed: 30,  // also swim 30 ft.
      abilities: { STR: 15, DEX: 10, CON: 13, INT: 7, WIS: 12, CHA: 7 },
      skills: ["perception +3", "stealth +4", "survival +5"],
      senses: ["passive Perception 13"],
      languages: ["Draconic"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Hold Breath"],
      // actions: Multiattack, Bite, Heavy Club, Javelin, Spiked Shield
      equipment: {
        armor: "natural_armor",
        mainHand: "heavy_club",
        offHand: "spiked_shield",
        pack: { name: "Carried", contents: ["javelin"] },
      },
    },
    MagmaMephit: {
      name: "Magma Mephit",
      size: "Small",
      type: "Elemental",
      tags: [],
      alignment: "Neutral Evil",
      ac: 11,
      hp: 22, // 22 (5d6 + 5)
      speed: 30,  // also fly 30 ft.
      abilities: { STR: 8, DEX: 12, CON: 12, INT: 7, WIS: 10, CHA: 10 },
      skills: ["stealth +3"],
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Ignan", "Terran"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Death Burst", "False Appearance", "Innate Spellcasting (1/Day)"],
      // actions: Claws, Fire Breath (Recharge 6)
      // vulnerable: cold
      // immune: fire, poison
      // condition immune: poisoned
    },
    Magmin: {
      size: "Small",
      type: "Elemental",
      tags: [],
      alignment: "Chaotic Neutral",
      ac: 14, // natural armor
      hp: 9, // 9 (2d6 + 2)
      speed: 30,
      abilities: { STR: 7, DEX: 15, CON: 12, INT: 8, WIS: 11, CHA: 10 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Ignan"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Death Burst", "Ignited Illumination"],
      // actions: Touch (fire)
      // resist: bludgeoning, piercing, and slashing from nonmagical attacks
      // immune: fire
      equipment: {
        armor: "natural_armor",
      },
    },
    Orc: {
      size: "Medium",
      type: "Humanoid",
      tags: ["orc"],
      alignment: "Chaotic Evil",
      ac: 13, // hide armor
      hp: 15, // 15 (2d8 + 6)
      speed: 30,
      abilities: { STR: 16, DEX: 12, CON: 16, INT: 7, WIS: 11, CHA: 10 },
      skills: ["intimidation +2"],
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Common", "Orc"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Aggressive"],
      equipment: {
        armor: "hide",
        mainHand: "greataxe",
        pack: { name: "Carried", contents: ["javelin"] },
      },
    },
    RustMonster: {
      name: "Rust Monster",
      size: "Medium",
      type: "Monstrosity",
      tags: [],
      alignment: "Unaligned",
      ac: 14, // natural armor
      hp: 27, // 27 (5d8 + 5)
      speed: 40,
      abilities: { STR: 13, DEX: 12, CON: 13, INT: 2, WIS: 13, CHA: 6 },
      senses: ["darkvision 60 ft.", "passive Perception 11"],
      languages: [],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Iron Scent", "Rust Metal"],
      // actions: Bite, Antennae (corrode metal)
      equipment: {
        armor: "natural_armor",
      },
    },
    Sahuagin: {
      size: "Medium",
      type: "Humanoid",
      tags: ["sahuagin"],
      alignment: "Lawful Evil",
      ac: 12, // natural armor
      hp: 22, // 22 (4d8 + 4)
      speed: 30,  // also swim 40 ft.
      abilities: { STR: 13, DEX: 11, CON: 12, INT: 12, WIS: 13, CHA: 9 },
      skills: ["perception +5"],
      senses: ["darkvision 120 ft.", "passive Perception 15"],
      languages: ["Sahuagin"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Blood Frenzy", "Limited Amphibiousness", "Shark Telepathy"],
      // actions: Multiattack, Bite, Claws, Spear
      equipment: {
        armor: "natural_armor",
        mainHand: "spear",
      },
    },
    Satyr: {
      size: "Medium",
      type: "Fey",
      tags: [],
      alignment: "Chaotic Neutral",
      ac: 14, // leather armor
      hp: 31, // 31 (7d8)
      speed: 40,
      abilities: { STR: 12, DEX: 16, CON: 11, INT: 12, WIS: 10, CHA: 14 },
      skills: ["perception +2", "performance +6", "stealth +5"],
      senses: ["passive Perception 12"],
      languages: ["Common", "Elvish", "Sylvan"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Magic Resistance"],
      // actions: Ram, Shortsword, Shortbow
      equipment: {
        armor: "leather",
        mainHand: "shortsword",
        pack: { name: "Carried", contents: ["shortbow"] },
      },
    },
    Scout: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 13, // leather armor
      hp: 16, // 16 (3d8 + 3)
      speed: 30,
      abilities: { STR: 11, DEX: 14, CON: 12, INT: 11, WIS: 13, CHA: 11 },
      skills: ["nature +4", "perception +5", "stealth +6", "survival +5"],
      senses: ["passive Perception 15"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Keen Hearing and Sight"],
      // actions: Multiattack, Shortsword, Longbow
      equipment: {
        armor: "leather",
        mainHand: "shortsword",
        pack: { name: "Carried", contents: ["longbow"] },
      },
    },
    Shadow: {
      size: "Medium",
      type: "Undead",
      tags: [],
      alignment: "Chaotic Evil",
      ac: 12,
      hp: 16, // 16 (3d8 + 3)
      speed: 40,
      abilities: { STR: 6, DEX: 14, CON: 13, INT: 6, WIS: 10, CHA: 8 },
      skills: ["stealth +4 (+6 in dim light or darkness)"],
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: [],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Amorphous", "Shadow Stealth", "Sunlight Weakness"],
      // actions: Strength Drain
      // vulnerable: radiant
      // resist: acid, cold, fire, lightning, thunder; bludgeoning, piercing, and slashing from nonmagical attacks
      // immune: necrotic, poison
      // condition immune: exhaustion, frightened, grappled, paralyzed, petrified, poisoned, prone, restrained
    },
    Thug: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Non-Good Alignment",
      ac: 11, // leather armor
      hp: 32, // 32 (5d8 + 10)
      speed: 30,
      abilities: { STR: 15, DEX: 11, CON: 14, INT: 10, WIS: 10, CHA: 11 },
      skills: ["intimidation +2"],
      senses: ["passive Perception 10"],
      languages: ["any one language (usually Common)"],
      challengeRating: 0.5,
      xpValue: 100,
      features: ["Pack Tactics"],
      // actions: Multiattack, Mace, Heavy Crossbow
      equipment: {
        armor: "leather",
        mainHand: "mace",
        pack: { name: "Carried", contents: ["heavy_crossbow"] },
      },
    },
    WarhorseSkeleton: {
      name: "Warhorse Skeleton",
      size: "Large",
      type: "Undead",
      tags: [],
      alignment: "Lawful Evil",
      ac: 13, // barding scraps
      hp: 22, // 22 (3d10 + 6)
      speed: 60,
      abilities: { STR: 18, DEX: 12, CON: 15, INT: 2, WIS: 8, CHA: 5 },
      senses: ["darkvision 60 ft.", "passive Perception 9"],
      languages: [],
      challengeRating: 0.5,
      xpValue: 100,
      features: [],
      // actions: Hooves
      // vulnerable: bludgeoning
      // immune: poison
      // condition immune: exhaustion, poisoned
      equipment: {
        armor: "barding_scraps",
      },
    },
    AnimatedArmor: {
      name: "Animated Armor",
      size: "Medium",
      type: "Construct",
      tags: [],
      alignment: "Unaligned",
      ac: 18, // natural armor
      hp: 33, // 33 (6d8 + 6)
      speed: 25,
      abilities: { STR: 14, DEX: 11, CON: 13, INT: 1, WIS: 3, CHA: 1 },
      senses: ["blindsight 60 ft. (blind beyond this radius)", "passive Perception 6"],
      languages: [],
      challengeRating: 1,
      xpValue: 200,
      features: ["Antimagic Susceptibility", "False Appearance"],
      // actions: Multiattack (2 slams), Slam
      // immune: poison, psychic
      // condition immune: blinded, charmed, deafened, exhaustion, frightened, paralyzed, petrified, poisoned
      equipment: {
        armor: "natural_armor",
      },
    },
    BrassDragonWyrmling: {
      name: "Brass Dragon Wyrmling",
      size: "Medium",
      type: "Dragon",
      tags: [],
      alignment: "Chaotic Good",
      ac: 16, // natural armor
      hp: 16, // 16 (3d8 + 3)
      speed: 30,  // also burrow 15 ft., fly 60 ft.
      abilities: { STR: 15, DEX: 10, CON: 13, INT: 10, WIS: 11, CHA: 13 },
      skills: ["perception +4", "stealth +2"],
      senses: ["blindsight 10 ft.", "darkvision 60 ft.", "passive Perception 14"],
      languages: ["Draconic"],
      challengeRating: 1,
      xpValue: 200,
      features: [],
      // actions: Bite, Breath Weapons (Recharge 5-6): Fire Breath / Sleep Breath
      // immune: fire
      // saving throws: Dex +2, Con +3, Wis +2, Cha +3
      equipment: {
        armor: "natural_armor",
      },
    },
    Bugbear: {
      size: "Medium",
      type: "Humanoid",
      tags: ["goblinoid"],
      alignment: "Chaotic Evil",
      ac: 16, // hide armor, shield
      hp: 27, // 27 (5d8 + 5)
      speed: 30,
      abilities: { STR: 15, DEX: 14, CON: 13, INT: 8, WIS: 11, CHA: 9 },
      skills: ["stealth +6", "survival +2"],
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Common", "Goblin"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Brute", "Surprise Attack"],
      equipment: {
        armor: "hide",
        mainHand: "morningstar",
        offHand: "shield",
        pack: { name: "Carried", contents: ["javelin"] },
      },
    },
    CopperDragonWyrmling: {
      name: "Copper Dragon Wyrmling",
      size: "Medium",
      type: "Dragon",
      tags: [],
      alignment: "Chaotic Good",
      ac: 16, // natural armor
      hp: 22, // 22 (4d8 + 4)
      speed: 30,  // also climb 30 ft., fly 60 ft.
      abilities: { STR: 15, DEX: 12, CON: 13, INT: 14, WIS: 11, CHA: 13 },
      skills: ["perception +4", "stealth +3"],
      senses: ["blindsight 10 ft.", "darkvision 60 ft.", "passive Perception 14"],
      languages: ["Draconic"],
      challengeRating: 1,
      xpValue: 200,
      features: [],
      // actions: Bite, Breath Weapons (Recharge 5-6): Acid Breath / Slowing Breath
      // immune: acid
      // saving throws: Dex +3, Con +3, Wis +2, Cha +3
      equipment: {
        armor: "natural_armor",
      },
    },
    Dryad: {
      size: "Medium",
      type: "Fey",
      tags: [],
      alignment: "Neutral",
      ac: 11, // 16 with barkskin
      hp: 22, // 22 (5d8)
      speed: 30,
      abilities: { STR: 10, DEX: 12, CON: 11, INT: 14, WIS: 15, CHA: 18 },
      skills: ["perception +4", "stealth +5"],
      senses: ["darkvision 60 ft.", "passive Perception 14"],
      languages: ["Elvish", "Sylvan"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Innate Spellcasting", "Magic Resistance", "Speak with Beasts and Plants", "Tree Stride"],
      // actions: Club, Fey Charm
      equipment: {
        mainHand: "club",
      },
    },
    Duergar: {
      size: "Medium",
      type: "Humanoid",
      tags: ["dwarf"],
      alignment: "Lawful Evil",
      ac: 16, // scale mail, shield
      hp: 26, // 26 (4d8 + 8)
      speed: 25,
      abilities: { STR: 14, DEX: 11, CON: 14, INT: 11, WIS: 10, CHA: 9 },
      senses: ["darkvision 120 ft.", "passive Perception 10"],
      languages: ["Dwarvish", "Undercommon"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Duergar Resilience", "Sunlight Sensitivity"],
      // actions: War Pick, Javelin, Enlarge and Invisibility (each recharges on a short or long rest)
      // resist: poison
      equipment: {
        armor: "scale_mail",
        mainHand: "war_pick",
        offHand: "shield",
        pack: { name: "Carried", contents: ["javelin"] },
      },
    },
    Ghoul: {
      size: "Medium",
      type: "Undead",
      tags: [],
      alignment: "Chaotic Evil",
      ac: 12,
      hp: 22, // 22 (5d8)
      speed: 30,
      abilities: { STR: 13, DEX: 15, CON: 10, INT: 7, WIS: 10, CHA: 6 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["Common"],
      challengeRating: 1,
      xpValue: 200,
      features: [],
      // actions: Bite, Claws (paralysis)
      // immune: poison
      // condition immune: charmed, exhaustion, poisoned
    },
    Harpy: {
      size: "Medium",
      type: "Monstrosity",
      tags: [],
      alignment: "Chaotic Evil",
      ac: 11,
      hp: 38, // 38 (7d8 + 7)
      speed: 20,  // also fly 40 ft.
      abilities: { STR: 12, DEX: 13, CON: 12, INT: 7, WIS: 10, CHA: 13 },
      senses: ["passive Perception 10"],
      languages: ["Common"],
      challengeRating: 1,
      xpValue: 200,
      features: [],
      // actions: Multiattack, Claws, Club, Luring Song
      equipment: {
        mainHand: "club",
      },
    },
    Hippogriff: {
      size: "Large",
      type: "Monstrosity",
      tags: [],
      alignment: "Unaligned",
      ac: 11,
      hp: 19, // 19 (3d10 + 3)
      speed: 40,  // also fly 60 ft.
      abilities: { STR: 17, DEX: 13, CON: 13, INT: 2, WIS: 12, CHA: 8 },
      skills: ["perception +5"],
      senses: ["passive Perception 15"],
      languages: [],
      challengeRating: 1,
      xpValue: 200,
      features: ["Keen Sight"],
      // actions: Multiattack, Beak, Claws
    },
    Imp: {
      size: "Tiny",
      type: "Fiend",
      tags: ["devil", "shapechanger"],
      alignment: "Lawful Evil",
      ac: 13,
      hp: 10, // 10 (3d4 + 3)
      speed: 20,  // also fly 40 ft.
      abilities: { STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14 },
      skills: ["deception +4", "insight +3", "persuasion +4", "stealth +5"],
      senses: ["darkvision 120 ft.", "passive Perception 11"],
      languages: ["Infernal", "Common"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Shapechanger", "Devil’s Sight", "Magic Resistance"],
      // actions: Sting (poison) or Bite in beast form, Invisibility
      // resist: cold; bludgeoning, piercing, and slashing from nonmagical attacks that aren’t silvered
      // immune: fire, poison
      // condition immune: poisoned
    },
    Quasit: {
      size: "Tiny",
      type: "Fiend",
      tags: ["demon", "shapechanger"],
      alignment: "Chaotic Evil",
      ac: 13,
      hp: 7, // 7 (3d4)
      speed: 40,
      abilities: { STR: 5, DEX: 17, CON: 10, INT: 7, WIS: 10, CHA: 10 },
      skills: ["stealth +5"],
      senses: ["darkvision 120 ft.", "passive Perception 10"],
      languages: ["Abyssal", "Common"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Shapechanger", "Magic Resistance"],
      // actions: Claws (poison) or Bite in beast form, Scare (1/Day), Invisibility
      // resist: cold, fire, lightning; bludgeoning, piercing, and slashing from nonmagical attacks
      // immune: poison
      // condition immune: poisoned
    },
    Specter: {
      size: "Medium",
      type: "Undead",
      tags: [],
      alignment: "Chaotic Evil",
      ac: 12,
      hp: 22, // 22 (5d8)
      speed: 0,  // also fly 50 ft. (hover)
      abilities: { STR: 1, DEX: 14, CON: 11, INT: 10, WIS: 10, CHA: 11 },
      senses: ["darkvision 60 ft.", "passive Perception 10"],
      languages: ["understands all languages it knew in life but can’t speak"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Incorporeal Movement", "Sunlight Sensitivity"],
      // actions: Life Drain
      // resist: acid, cold, fire, lightning, thunder; bludgeoning, piercing, and slashing from nonmagical attacks
      // immune: necrotic, poison
      // condition immune: charmed, exhaustion, grappled, paralyzed, petrified, poisoned, prone, restrained, unconscious
    },
    Spy: {
      size: "Medium",
      type: "Humanoid",
      tags: ["any race"],
      alignment: "Any Alignment",
      ac: 12,
      hp: 27, // 27 (6d8)
      speed: 30,
      abilities: { STR: 10, DEX: 15, CON: 10, INT: 12, WIS: 14, CHA: 16 },
      skills: ["deception +5", "insight +4", "investigation +5", "perception +6", "persuasion +5", "sleight of hand +4", "stealth +4"],
      senses: ["passive Perception 16"],
      languages: ["any two languages"],
      challengeRating: 1,
      xpValue: 200,
      features: ["Cunning Action", "Sneak Attack (1/Turn)"],
      // actions: Multiattack, Shortsword, Hand Crossbow
      equipment: {
        mainHand: "shortsword",
        pack: { name: "Carried", contents: ["hand_crossbow"] },
      },
    },
  };