#!/usr/bin/env python3
"""
SRD 5.1 Level-1 Character Generator
------------------------------------
Generates a random, rules-legal 1st-level 5e character as JSON, built
entirely from data extracted from SRD-OGL_V5_1_with_bookmarks_v03.pdf
(the System Reference Document 5.1, released under the Open Gaming
License v1.0a).

SCOPE AND KNOWN GAPS (read this before trusting the output blindly):

1. Backgrounds: the SRD 5.1 gives full mechanical benefits for exactly
   ONE background - Acolyte. It does not include Criminal, Soldier,
   Sage, etc. with mechanical detail. This generator therefore always
   assigns Acolyte. If you want other backgrounds you'll need to supply
   their data yourself (e.g. from the Player's Handbook, which is not
   Open Game Content and is not in this document).

2. Subraces: for each race with subraces, the SRD 5.1 only details ONE
   sample subrace (Hill Dwarf, High Elf, Lightfoot Halfling, Rock
   Gnome). Variants like Mountain Dwarf, Wood Elf, Drow, Stout
   Halfling, Forest Gnome, or Deep Gnome are PHB content, not SRD
   content, and are not included here.

3. Ability score generation: the SRD 5.1 does NOT define a method for
   generating ability scores. Its one mention of ability generation
   (in the sentient-magic-item rules, "roll 4d6 for each one, dropping
   the lowest") is for item stats, not characters, and the "Ability
   Scores" heading in the monster rules explicitly says "see the
   Player's Handbook." So the standard array [15, 14, 13, 12, 10, 8]
   used below, and the priority order used to assign it to abilities
   per class, are NOT sourced from the SRD - they're a common, widely
   used convention supplied here to make generation possible. Treat
   ability scores as a reasonable default, not as an SRD-mandated rule.

4. Spells: cantrip/1st-level spell lists are included for the six
   classes that have them at level 1 (Bard, Cleric, Druid, Sorcerer,
   Warlock, Wizard). Paladins and Rangers get no spells at level 1 in
   the SRD tables, so none are generated for them.

5. This generates LEVEL 1 characters only.

Everything else (racial traits, class hit dice/proficiencies/starting
equipment, the Acolyte background, armor/weapon/pack statistics,
alignments, languages, tool list, and spell lists) was extracted
directly from the supplied PDF's text layer, not from the model's
memory of the retail Player's Handbook, which differs from the SRD in
several places (fewer subraces, one sample background, no feats
detail beyond the SRD's own feat list, etc).
"""

import argparse
import json
import random

# ---------------------------------------------------------------------------
# DATA (extracted from the SRD PDF)
# ---------------------------------------------------------------------------

ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"]

ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
]

STANDARD_LANGUAGES = ["Common", "Dwarvish", "Elvish", "Giant", "Gnomish",
                       "Goblin", "Halfling", "Orc"]
EXOTIC_LANGUAGES = ["Abyssal", "Celestial", "Draconic", "Deep Speech",
                     "Infernal", "Primordial", "Sylvan", "Undercommon"]
ALL_CHOOSABLE_LANGUAGES = STANDARD_LANGUAGES + EXOTIC_LANGUAGES

ALL_SKILLS = [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
    "History", "Insight", "Intimidation", "Investigation", "Medicine",
    "Nature", "Perception", "Performance", "Persuasion", "Religion",
    "Sleight of Hand", "Stealth", "Survival",
]

MUSICAL_INSTRUMENTS = ["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute",
                        "Lyre", "Horn", "Pan flute", "Shawm", "Viol"]
ARTISANS_TOOLS = ["Alchemist's supplies", "Brewer's supplies",
                   "Calligrapher's supplies", "Carpenter's tools",
                   "Cartographer's tools", "Cobbler's tools",
                   "Cook's utensils", "Glassblower's tools",
                   "Jeweler's tools", "Leatherworker's tools",
                   "Mason's tools", "Painter's supplies", "Potter's tools",
                   "Smith's tools", "Tinker's tools", "Weaver's tools",
                   "Woodcarver's tools"]

# --- Draconic Ancestry table (Dragonborn) ---
DRACONIC_ANCESTRY = {
    "Black":  {"damage_type": "Acid",      "breath_weapon": "5 by 30 ft. line (Dex. save)"},
    "Blue":   {"damage_type": "Lightning", "breath_weapon": "5 by 30 ft. line (Dex. save)"},
    "Brass":  {"damage_type": "Fire",      "breath_weapon": "5 by 30 ft. line (Dex. save)"},
    "Bronze": {"damage_type": "Lightning", "breath_weapon": "5 by 30 ft. line (Dex. save)"},
    "Copper": {"damage_type": "Acid",      "breath_weapon": "5 by 30 ft. line (Dex. save)"},
    "Gold":   {"damage_type": "Fire",      "breath_weapon": "15 ft. cone (Dex. save)"},
    "Green":  {"damage_type": "Poison",    "breath_weapon": "15 ft. cone (Con. save)"},
    "Red":    {"damage_type": "Fire",      "breath_weapon": "15 ft. cone (Dex. save)"},
    "Silver": {"damage_type": "Cold",      "breath_weapon": "15 ft. cone (Con. save)"},
    "White":  {"damage_type": "Cold",      "breath_weapon": "15 ft. cone (Con. save)"},
}

# --- Races ---
# "skill_bonus": fixed skill(s) granted by race, always applied
# "skill_choice": (count, pool) skills the player picks; pool=None means any skill
RACES = {
    "Dwarf": {
        "ability_bonus": {"CON": 2},
        "size": "Medium", "speed": 25,
        "languages": ["Common", "Dwarvish"],
        "weapon_proficiencies": ["battleaxe", "handaxe", "light hammer", "warhammer"],
        "tool_proficiency_choice": ["Smith's tools", "Brewer's supplies", "Mason's tools"],
        "traits": [
            "Darkvision (60 ft.)",
            "Dwarven Resilience: advantage on saving throws against poison, resistance to poison damage",
            "Dwarven Combat Training: proficiency with battleaxe, handaxe, light hammer, warhammer",
            "Tool Proficiency: proficiency with one of smith's tools, brewer's supplies, or mason's tools",
            "Stonecunning: double proficiency bonus on History checks about the origin of stonework",
        ],
        "subraces": {
            "Hill Dwarf": {
                "ability_bonus": {"WIS": 1},
                "hp_bonus_per_level": 1,
                "traits": ["Dwarven Toughness: hit point maximum increases by 1, and by 1 again every level"],
            },
        },
    },
    "Elf": {
        "ability_bonus": {"DEX": 2},
        "size": "Medium", "speed": 30,
        "languages": ["Common", "Elvish"],
        "skill_bonus": ["Perception"],
        "traits": [
            "Darkvision (60 ft.)",
            "Keen Senses: proficiency in the Perception skill",
            "Fey Ancestry: advantage on saving throws against being charmed, immune to magical sleep",
            "Trance: 4 hours of trance-meditation substitutes for 8 hours of sleep",
        ],
        "subraces": {
            "High Elf": {
                "ability_bonus": {"INT": 1},
                "weapon_proficiencies": ["longsword", "shortsword", "shortbow", "longbow"],
                "cantrip_from_wizard_list": True,
                "extra_language": True,
                "traits": [
                    "Elf Weapon Training: proficiency with longsword, shortsword, shortbow, longbow",
                    "Cantrip: one wizard cantrip of choice (Intelligence is the spellcasting ability)",
                    "Extra Language: one extra language of choice",
                ],
            },
        },
    },
    "Halfling": {
        "ability_bonus": {"DEX": 2},
        "size": "Small", "speed": 25,
        "languages": ["Common", "Halfling"],
        "traits": [
            "Lucky: reroll a natural 1 on an attack roll, ability check, or saving throw",
            "Brave: advantage on saving throws against being frightened",
            "Halfling Nimbleness: can move through the space of any creature that is a size larger",
        ],
        "subraces": {
            "Lightfoot Halfling": {
                "ability_bonus": {"CHA": 1},
                "traits": ["Naturally Stealthy: can hide even when obscured only by a creature one size larger"],
            },
        },
    },
    "Human": {
        "ability_bonus": {"STR": 1, "DEX": 1, "CON": 1, "INT": 1, "WIS": 1, "CHA": 1},
        "size": "Medium", "speed": 30,
        "languages": ["Common"],
        "extra_language": True,
        "traits": ["Ability scores each increase by 1", "One extra language of choice"],
        "subraces": {},
    },
    "Dragonborn": {
        "ability_bonus": {"STR": 2, "CHA": 1},
        "size": "Medium", "speed": 30,
        "languages": ["Common", "Draconic"],
        "traits": [
            "Draconic Ancestry: choose a dragon type, determining breath weapon and damage resistance",
            "Breath Weapon: action to exhale energy in the shape/damage type of draconic ancestry; "
            "save DC = 8 + Con modifier + proficiency bonus; 2d6 damage (half on success) at level 1; "
            "usable once per short or long rest",
            "Damage Resistance to the damage type of draconic ancestry",
        ],
        "subraces": {},
    },
    "Gnome": {
        "ability_bonus": {"INT": 2},
        "size": "Small", "speed": 25,
        "languages": ["Common", "Gnomish"],
        "traits": [
            "Darkvision (60 ft.)",
            "Gnome Cunning: advantage on Intelligence, Wisdom, and Charisma saving throws against magic",
        ],
        "subraces": {
            "Rock Gnome": {
                "ability_bonus": {"CON": 1},
                "tool_proficiencies": ["Tinker's tools"],
                "traits": [
                    "Artificer's Lore: double proficiency bonus on History checks about magic items, "
                    "alchemical objects, or technological devices",
                    "Tinker: proficiency with tinker's tools; can build a Tiny clockwork device "
                    "(clockwork toy, fire starter, or music box) with 1 hour and 10 gp of materials",
                ],
            },
        },
    },
    "Half-Elf": {
        "ability_bonus": {"CHA": 2},
        "ability_bonus_choice": {"count": 2, "amount": 1, "exclude": ["CHA"]},
        "size": "Medium", "speed": 30,
        "languages": ["Common", "Elvish"],
        "extra_language": True,
        "skill_choice": {"count": 2, "pool": None},
        "traits": [
            "Darkvision (60 ft.)",
            "Fey Ancestry: advantage on saving throws against being charmed, immune to magical sleep",
            "Skill Versatility: proficiency in two skills of choice",
        ],
        "subraces": {},
    },
    "Half-Orc": {
        "ability_bonus": {"STR": 2, "CON": 1},
        "size": "Medium", "speed": 30,
        "languages": ["Common", "Orc"],
        "skill_bonus": ["Intimidation"],
        "traits": [
            "Darkvision (60 ft.)",
            "Menacing: proficiency in the Intimidation skill",
            "Relentless Endurance: when reduced to 0 HP but not killed outright, can drop to 1 HP "
            "instead (once per long rest)",
            "Savage Attacks: on a melee critical hit, roll one extra weapon damage die",
        ],
        "subraces": {},
    },
    "Tiefling": {
        "ability_bonus": {"INT": 1, "CHA": 2},
        "size": "Medium", "speed": 30,
        "languages": ["Common", "Infernal"],
        "traits": [
            "Darkvision (60 ft.)",
            "Hellish Resistance: resistance to fire damage",
            "Infernal Legacy: knows the thaumaturgy cantrip (Charisma is the spellcasting ability); "
            "hellish rebuke and darkness become available at higher levels",
        ],
        "subraces": {},
    },
}

# --- Classes ---
CLASSES = {
    "Barbarian": {
        "hit_die": 12,
        "saving_throws": ["STR", "CON"],
        "armor_proficiencies": ["Light armor", "Medium armor", "Shields"],
        "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["Animal Handling", "Athletics", "Intimidation",
                                               "Nature", "Perception", "Survival"]},
        "equipment_options": [
            {"choose": ["a greataxe", "any martial melee weapon"]},
            {"choose": ["two handaxes", "any simple weapon"]},
            {"fixed": ["Explorer's pack", "4 javelins"]},
        ],
        "level1_features": ["Rage", "Unarmored Defense (10 + Dex mod + Con mod, no shield doesn't apply, "
                             "shield still allowed)"],
        "ability_priority": ["STR", "CON", "DEX", "WIS", "CHA", "INT"],
        "unarmored_defense": "barbarian",
        "spellcasting": None,
    },
    "Bard": {
        "hit_die": 8,
        "saving_throws": ["DEX", "CHA"],
        "armor_proficiencies": ["Light armor"],
        "weapon_proficiencies": ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
        "tool_proficiencies": {"choose": 3, "pool": MUSICAL_INSTRUMENTS, "label": "musical instrument"},
        "skill_choice": {"count": 3, "pool": ALL_SKILLS},
        "equipment_options": [
            {"choose": ["a rapier", "a longsword", "any simple weapon"]},
            {"choose": ["a diplomat's pack", "an entertainer's pack"]},
            {"choose": ["a lute", "any other musical instrument"]},
            {"fixed": ["Leather armor", "a dagger"]},
        ],
        "level1_features": ["Spellcasting", "Bardic Inspiration (d6)"],
        "ability_priority": ["CHA", "DEX", "CON", "WIS", "INT", "STR"],
        "unarmored_defense": None,
        "spellcasting": {"ability": "CHA", "type": "known", "cantrips_known": 2, "spells_known": 4,
                          "slots": {"1": 2}},
    },
    "Cleric": {
        "hit_die": 8,
        "saving_throws": ["WIS", "CHA"],
        "armor_proficiencies": ["Light armor", "Medium armor", "Shields"],
        "weapon_proficiencies": ["Simple weapons"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["History", "Insight", "Medicine", "Persuasion", "Religion"]},
        "equipment_options": [
            {"choose": ["a mace", "a warhammer (if proficient)"]},
            {"choose": ["scale mail", "leather armor", "chain mail (if proficient)"]},
            {"choose": ["a light crossbow and 20 bolts", "any simple weapon"]},
            {"choose": ["a priest's pack", "an explorer's pack"]},
            {"fixed": ["A shield", "a holy symbol"]},
        ],
        "level1_features": ["Spellcasting", "Divine Domain"],
        "ability_priority": ["WIS", "CON", "STR", "CHA", "DEX", "INT"],
        "unarmored_defense": None,
        "spellcasting": {"ability": "WIS", "type": "prepared", "cantrips_known": 3, "slots": {"1": 2}},
    },
    "Druid": {
        "hit_die": 8,
        "saving_throws": ["INT", "WIS"],
        "armor_proficiencies": ["Light armor", "Medium armor", "Shields (non-metal only)"],
        "weapon_proficiencies": ["Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs",
                                  "Scimitars", "Sickles", "Slings", "Spears"],
        "tool_proficiencies": ["Herbalism kit"],
        "skill_choice": {"count": 2, "pool": ["Arcana", "Animal Handling", "Insight", "Medicine",
                                               "Nature", "Perception", "Religion", "Survival"]},
        "equipment_options": [
            {"choose": ["a wooden shield", "any simple weapon"]},
            {"choose": ["a scimitar", "any simple melee weapon"]},
            {"fixed": ["Leather armor", "an explorer's pack", "a druidic focus"]},
        ],
        "level1_features": ["Druidic", "Spellcasting"],
        "ability_priority": ["WIS", "CON", "DEX", "INT", "CHA", "STR"],
        "unarmored_defense": None,
        "spellcasting": {"ability": "WIS", "type": "prepared", "cantrips_known": 2, "slots": {"1": 2}},
    },
    "Fighter": {
        "hit_die": 10,
        "saving_throws": ["STR", "CON"],
        "armor_proficiencies": ["All armor", "Shields"],
        "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["Acrobatics", "Animal Handling", "Athletics", "History",
                                               "Insight", "Intimidation", "Perception", "Survival"]},
        "equipment_options": [
            {"choose": ["chain mail", "leather armor, longbow, and 20 arrows"]},
            {"choose": ["a martial weapon and a shield", "two martial weapons"]},
            {"choose": ["a light crossbow and 20 bolts", "two handaxes"]},
            {"choose": ["a dungeoneer's pack", "an explorer's pack"]},
        ],
        "level1_features": ["Fighting Style", "Second Wind"],
        "ability_priority": ["STR", "CON", "DEX", "WIS", "INT", "CHA"],
        "unarmored_defense": None,
        "spellcasting": None,
    },
    "Monk": {
        "hit_die": 8,
        "saving_throws": ["STR", "DEX"],
        "armor_proficiencies": [],
        "weapon_proficiencies": ["Simple weapons", "Shortswords"],
        "tool_proficiencies": {"choose": 1, "pool": ARTISANS_TOOLS + MUSICAL_INSTRUMENTS,
                                "label": "artisan's tools or musical instrument"},
        "skill_choice": {"count": 2, "pool": ["Acrobatics", "Athletics", "History", "Insight",
                                               "Religion", "Stealth"]},
        "equipment_options": [
            {"choose": ["a shortsword", "any simple weapon"]},
            {"choose": ["a dungeoneer's pack", "an explorer's pack"]},
            {"fixed": ["10 darts"]},
        ],
        "level1_features": ["Unarmored Defense (10 + Dex mod + Wis mod)", "Martial Arts (1d4)"],
        "ability_priority": ["DEX", "WIS", "CON", "STR", "INT", "CHA"],
        "unarmored_defense": "monk",
        "spellcasting": None,
    },
    "Paladin": {
        "hit_die": 10,
        "saving_throws": ["WIS", "CHA"],
        "armor_proficiencies": ["All armor", "Shields"],
        "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["Athletics", "Insight", "Intimidation", "Medicine",
                                               "Persuasion", "Religion"]},
        "equipment_options": [
            {"choose": ["a martial weapon and a shield", "two martial weapons"]},
            {"choose": ["five javelins", "any simple melee weapon"]},
            {"choose": ["a priest's pack", "an explorer's pack"]},
            {"fixed": ["Chain mail", "a holy symbol"]},
        ],
        "level1_features": ["Divine Sense", "Lay on Hands"],
        "ability_priority": ["STR", "CHA", "CON", "WIS", "DEX", "INT"],
        "unarmored_defense": None,
        "spellcasting": None,  # Paladin spellcasting begins at 2nd level per the SRD table
    },
    "Ranger": {
        "hit_die": 10,
        "saving_throws": ["STR", "DEX"],
        "armor_proficiencies": ["Light armor", "Medium armor", "Shields"],
        "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 3, "pool": ["Animal Handling", "Athletics", "Insight", "Investigation",
                                               "Nature", "Perception", "Stealth", "Survival"]},
        "equipment_options": [
            {"choose": ["scale mail", "leather armor"]},
            {"choose": ["two shortswords", "two simple melee weapons"]},
            {"choose": ["a dungeoneer's pack", "an explorer's pack"]},
            {"fixed": ["A longbow and a quiver of 20 arrows"]},
        ],
        "level1_features": ["Favored Enemy", "Natural Explorer"],
        "ability_priority": ["DEX", "WIS", "CON", "STR", "INT", "CHA"],
        "unarmored_defense": None,
        "spellcasting": None,  # Ranger spellcasting begins at 2nd level per the SRD table
    },
    "Rogue": {
        "hit_die": 8,
        "saving_throws": ["DEX", "INT"],
        "armor_proficiencies": ["Light armor"],
        "weapon_proficiencies": ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
        "tool_proficiencies": ["Thieves' tools"],
        "skill_choice": {"count": 4, "pool": ["Acrobatics", "Athletics", "Deception", "Insight",
                                               "Intimidation", "Investigation", "Perception",
                                               "Performance", "Persuasion", "Sleight of Hand", "Stealth"]},
        "equipment_options": [
            {"choose": ["a rapier", "a shortsword"]},
            {"choose": ["a shortbow and quiver of 20 arrows", "a shortsword"]},
            {"choose": ["a burglar's pack", "a dungeoneer's pack", "an explorer's pack"]},
            {"fixed": ["Leather armor", "two daggers", "thieves' tools"]},
        ],
        "level1_features": ["Expertise", "Sneak Attack (1d6)", "Thieves' Cant"],
        "ability_priority": ["DEX", "INT", "CON", "WIS", "CHA", "STR"],
        "unarmored_defense": None,
        "spellcasting": None,
    },
    "Sorcerer": {
        "hit_die": 6,
        "saving_throws": ["CON", "CHA"],
        "armor_proficiencies": [],
        "weapon_proficiencies": ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["Arcana", "Deception", "Insight", "Intimidation",
                                               "Persuasion", "Religion"]},
        "equipment_options": [
            {"choose": ["a light crossbow and 20 bolts", "any simple weapon"]},
            {"choose": ["a component pouch", "an arcane focus"]},
            {"choose": ["a dungeoneer's pack", "an explorer's pack"]},
            {"fixed": ["Two daggers"]},
        ],
        "level1_features": ["Spellcasting", "Sorcerous Origin"],
        "ability_priority": ["CHA", "CON", "DEX", "WIS", "INT", "STR"],
        "unarmored_defense": None,
        "spellcasting": {"ability": "CHA", "type": "known", "cantrips_known": 4, "spells_known": 2,
                          "slots": {"1": 2}},
    },
    "Warlock": {
        "hit_die": 8,
        "saving_throws": ["WIS", "CHA"],
        "armor_proficiencies": ["Light armor"],
        "weapon_proficiencies": ["Simple weapons"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["Arcana", "Deception", "History", "Intimidation",
                                               "Investigation", "Nature", "Religion"]},
        "equipment_options": [
            {"choose": ["a light crossbow and 20 bolts", "any simple weapon"]},
            {"choose": ["a component pouch", "an arcane focus"]},
            {"choose": ["a scholar's pack", "a dungeoneer's pack"]},
            {"fixed": ["Leather armor", "any simple weapon", "two daggers"]},
        ],
        "level1_features": ["Otherworldly Patron", "Pact Magic"],
        "ability_priority": ["CHA", "CON", "DEX", "WIS", "INT", "STR"],
        "unarmored_defense": None,
        "spellcasting": {"ability": "CHA", "type": "known", "cantrips_known": 2, "spells_known": 2,
                          "slots": {"1": 1}, "pact_magic": True},
    },
    "Wizard": {
        "hit_die": 6,
        "saving_throws": ["INT", "WIS"],
        "armor_proficiencies": [],
        "weapon_proficiencies": ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
        "tool_proficiencies": [],
        "skill_choice": {"count": 2, "pool": ["Arcana", "History", "Insight", "Investigation",
                                               "Medicine", "Religion"]},
        "equipment_options": [
            {"choose": ["a quarterstaff", "a dagger"]},
            {"choose": ["a component pouch", "an arcane focus"]},
            {"choose": ["a scholar's pack", "an explorer's pack"]},
            {"fixed": ["A spellbook"]},
        ],
        "level1_features": ["Spellcasting", "Arcane Recovery"],
        "ability_priority": ["INT", "DEX", "CON", "WIS", "CHA", "STR"],
        "unarmored_defense": None,
        "spellcasting": {"ability": "INT", "type": "spellbook", "cantrips_known": 3,
                          "spellbook_size": 6, "slots": {"1": 2}},
    },
}

# --- Background (the SRD 5.1 gives full mechanical detail for one background only) ---
BACKGROUND_ACOLYTE = {
    "name": "Acolyte",
    "skill_proficiencies": ["Insight", "Religion"],
    "language_choice": 2,
    "equipment": ["A holy symbol", "A prayer book or prayer wheel", "5 sticks of incense",
                  "Vestments", "A set of common clothes", "A pouch containing 15 gp"],
    "feature": {
        "name": "Shelter of the Faithful",
        "text": "You command the respect of those who share your faith and can perform its "
                 "religious ceremonies. You and your companions can expect free healing and care at "
                 "a temple, shrine, or other established presence of your faith (you must provide "
                 "material components for spells yourself). Those who share your religion will "
                 "support you, but only you, at a modest lifestyle.",
    },
}

# --- Armor table: name -> (cost, base AC formula info, str_req, stealth_disadvantage, weight) ---
ARMOR = {
    "Padded":         {"category": "light",  "cost": "5 gp",   "base_ac": 11, "str_req": None, "stealth_dis": True,  "weight": 8},
    "Leather":        {"category": "light",  "cost": "10 gp",  "base_ac": 11, "str_req": None, "stealth_dis": False, "weight": 10},
    "Studded leather":{"category": "light",  "cost": "45 gp",  "base_ac": 12, "str_req": None, "stealth_dis": False, "weight": 13},
    "Hide":           {"category": "medium", "cost": "10 gp",  "base_ac": 12, "str_req": None, "stealth_dis": False, "weight": 12},
    "Chain shirt":    {"category": "medium", "cost": "50 gp",  "base_ac": 13, "str_req": None, "stealth_dis": False, "weight": 20},
    "Scale mail":     {"category": "medium", "cost": "50 gp",  "base_ac": 14, "str_req": None, "stealth_dis": True,  "weight": 45},
    "Breastplate":    {"category": "medium", "cost": "400 gp", "base_ac": 14, "str_req": None, "stealth_dis": False, "weight": 20},
    "Half plate":     {"category": "medium", "cost": "750 gp", "base_ac": 15, "str_req": None, "stealth_dis": True,  "weight": 40},
    "Ring mail":      {"category": "heavy",  "cost": "30 gp",  "base_ac": 14, "str_req": None, "stealth_dis": True,  "weight": 40},
    "Chain mail":     {"category": "heavy",  "cost": "75 gp",  "base_ac": 16, "str_req": 13,   "stealth_dis": True,  "weight": 55},
    "Splint":         {"category": "heavy",  "cost": "200 gp", "base_ac": 17, "str_req": 15,   "stealth_dis": True,  "weight": 60},
    "Plate":          {"category": "heavy",  "cost": "1500 gp","base_ac": 18, "str_req": 15,   "stealth_dis": True,  "weight": 65},
}
SHIELD_AC_BONUS = 2

WEAPONS = {
    "club":            {"cost": "1 sp", "damage": "1d4 bludgeoning", "weight": 2,  "properties": ["Light"]},
    "dagger":          {"cost": "2 gp", "damage": "1d4 piercing", "weight": 1,  "properties": ["Finesse", "Light", "Thrown (20/60)"]},
    "greatclub":       {"cost": "2 sp", "damage": "1d8 bludgeoning", "weight": 10, "properties": ["Two-handed"]},
    "handaxe":         {"cost": "5 gp", "damage": "1d6 slashing", "weight": 2,  "properties": ["Light", "Thrown (20/60)"]},
    "javelin":         {"cost": "5 sp", "damage": "1d6 piercing", "weight": 2,  "properties": ["Thrown (30/120)"]},
    "light hammer":    {"cost": "2 gp", "damage": "1d4 bludgeoning", "weight": 2,  "properties": ["Light", "Thrown (20/60)"]},
    "mace":            {"cost": "5 gp", "damage": "1d6 bludgeoning", "weight": 4,  "properties": []},
    "quarterstaff":    {"cost": "2 sp", "damage": "1d6 bludgeoning", "weight": 4,  "properties": ["Versatile (1d8)"]},
    "sickle":          {"cost": "1 gp", "damage": "1d4 slashing", "weight": 2,  "properties": ["Light"]},
    "spear":           {"cost": "1 gp", "damage": "1d6 piercing", "weight": 3,  "properties": ["Thrown (20/60)", "Versatile (1d8)"]},
    "light crossbow":  {"cost": "25 gp","damage": "1d8 piercing", "weight": 5,  "properties": ["Ammunition (80/320)", "Loading", "Two-handed"]},
    "dart":            {"cost": "5 cp", "damage": "1d4 piercing", "weight": 0.25, "properties": ["Finesse", "Thrown (20/60)"]},
    "shortbow":        {"cost": "25 gp","damage": "1d6 piercing", "weight": 2,  "properties": ["Ammunition (80/320)", "Two-handed"]},
    "sling":           {"cost": "1 sp", "damage": "1d4 bludgeoning", "weight": 0, "properties": ["Ammunition (30/120)"]},
    "battleaxe":       {"cost": "10 gp","damage": "1d8 slashing", "weight": 4,  "properties": ["Versatile (1d10)"]},
    "flail":           {"cost": "10 gp","damage": "1d8 bludgeoning", "weight": 2,  "properties": []},
    "glaive":          {"cost": "20 gp","damage": "1d10 slashing", "weight": 6,  "properties": ["Heavy", "Reach", "Two-handed"]},
    "greataxe":        {"cost": "30 gp","damage": "1d12 slashing", "weight": 7,  "properties": ["Heavy", "Two-handed"]},
    "greatsword":      {"cost": "50 gp","damage": "2d6 slashing", "weight": 6,  "properties": ["Heavy", "Two-handed"]},
    "halberd":         {"cost": "20 gp","damage": "1d10 slashing", "weight": 6,  "properties": ["Heavy", "Reach", "Two-handed"]},
    "lance":           {"cost": "10 gp","damage": "1d12 piercing", "weight": 6,  "properties": ["Reach", "Special"]},
    "longsword":       {"cost": "15 gp","damage": "1d8 slashing", "weight": 3,  "properties": ["Versatile (1d10)"]},
    "maul":            {"cost": "10 gp","damage": "2d6 bludgeoning", "weight": 10, "properties": ["Heavy", "Two-handed"]},
    "morningstar":     {"cost": "15 gp","damage": "1d8 piercing", "weight": 4,  "properties": []},
    "pike":            {"cost": "5 gp", "damage": "1d10 piercing", "weight": 18, "properties": ["Heavy", "Reach", "Two-handed"]},
    "rapier":          {"cost": "25 gp","damage": "1d8 piercing", "weight": 2,  "properties": ["Finesse"]},
    "scimitar":        {"cost": "25 gp","damage": "1d6 slashing", "weight": 3,  "properties": ["Finesse", "Light"]},
    "shortsword":      {"cost": "10 gp","damage": "1d6 piercing", "weight": 2,  "properties": ["Finesse", "Light"]},
    "trident":         {"cost": "5 gp", "damage": "1d6 piercing", "weight": 4,  "properties": ["Thrown (20/60)", "Versatile (1d8)"]},
    "war pick":        {"cost": "5 gp", "damage": "1d8 piercing", "weight": 2,  "properties": []},
    "warhammer":       {"cost": "15 gp","damage": "1d8 bludgeoning", "weight": 2,  "properties": ["Versatile (1d10)"]},
    "whip":            {"cost": "2 gp", "damage": "1d4 slashing", "weight": 3,  "properties": ["Finesse", "Reach"]},
    "blowgun":         {"cost": "10 gp","damage": "1 piercing", "weight": 1,  "properties": ["Ammunition (25/100)", "Loading"]},
    "hand crossbow":   {"cost": "75 gp","damage": "1d6 piercing", "weight": 3,  "properties": ["Ammunition (30/120)", "Light", "Loading"]},
    "heavy crossbow":  {"cost": "50 gp","damage": "1d10 piercing", "weight": 18, "properties": ["Ammunition (100/400)", "Heavy", "Loading", "Two-handed"]},
    "longbow":         {"cost": "50 gp","damage": "1d8 piercing", "weight": 2,  "properties": ["Ammunition (150/600)", "Heavy", "Two-handed"]},
    "net":             {"cost": "1 gp", "damage": "-", "weight": 3, "properties": ["Special", "Thrown (5/15)"]},
}

EQUIPMENT_PACKS = {
    "Burglar's pack": {"cost": "16 gp", "contents": ["Backpack", "Bag of 1,000 ball bearings", "10 ft. string",
                        "Bell", "5 candles", "Crowbar", "Hammer", "10 pitons", "Hooded lantern", "2 flasks of oil",
                        "5 days rations", "Tinderbox", "Waterskin", "50 ft. hempen rope"]},
    "Diplomat's pack": {"cost": "39 gp", "contents": ["Chest", "2 cases for maps and scrolls", "Fine clothes",
                         "Bottle of ink", "Ink pen", "Lamp", "2 flasks of oil", "5 sheets of paper",
                         "Vial of perfume", "Sealing wax", "Soap"]},
    "Dungeoneer's pack": {"cost": "12 gp", "contents": ["Backpack", "Crowbar", "Hammer", "10 pitons", "10 torches",
                           "Tinderbox", "10 days of rations", "Waterskin", "50 ft. hempen rope"]},
    "Entertainer's pack": {"cost": "40 gp", "contents": ["Backpack", "Bedroll", "2 costumes", "5 candles",
                            "5 days of rations", "Waterskin", "Disguise kit"]},
    "Explorer's pack": {"cost": "10 gp", "contents": ["Backpack", "Bedroll", "Mess kit", "Tinderbox", "10 torches",
                         "10 days of rations", "Waterskin", "50 ft. hempen rope"]},
    "Priest's pack": {"cost": "19 gp", "contents": ["Backpack", "Blanket", "10 candles", "Tinderbox", "Alms box",
                       "2 blocks of incense", "Censer", "Vestments", "2 days of rations", "Waterskin"]},
    "Scholar's pack": {"cost": "40 gp", "contents": ["Backpack", "Book of lore", "Bottle of ink", "Ink pen",
                        "10 sheets of parchment", "Little bag of sand", "Small knife"]},
}

# --- Spell lists (cantrips + 1st level only; sufficient for a level-1 character) ---
SPELLS = {
    "Bard": {
        "cantrips": ["Dancing Lights", "Light", "Mage Hand", "Mending", "Message", "Minor Illusion",
                     "Prestidigitation", "True Strike", "Vicious Mockery"],
        "level1": ["Animal Friendship", "Bane", "Charm Person", "Comprehend Languages", "Cure Wounds",
                   "Detect Magic", "Disguise Self", "Faerie Fire", "Feather Fall", "Healing Word",
                   "Heroism", "Hideous Laughter", "Identify", "Illusory Script", "Longstrider",
                   "Silent Image", "Sleep", "Speak with Animals", "Thunderwave", "Unseen Servant"],
    },
    "Cleric": {
        "cantrips": ["Guidance", "Light", "Mending", "Resistance", "Sacred Flame", "Spare the Dying",
                     "Thaumaturgy"],
        "level1": ["Bane", "Bless", "Command", "Create or Destroy Water", "Cure Wounds",
                   "Detect Evil and Good", "Detect Magic", "Detect Poison and Disease", "Guiding Bolt",
                   "Healing Word", "Inflict Wounds", "Protection from Evil and Good",
                   "Purify Food and Drink", "Sanctuary", "Shield of Faith"],
    },
    "Druid": {
        "cantrips": ["Druidcraft", "Guidance", "Mending", "Poison Spray", "Produce Flame", "Resistance",
                     "Shillelagh"],
        "level1": ["Animal Friendship", "Charm Person", "Create or Destroy Water", "Cure Wounds",
                   "Detect Magic", "Detect Poison and Disease", "Entangle", "Faerie Fire", "Fog Cloud",
                   "Goodberry", "Healing Word", "Jump", "Longstrider", "Purify Food and Drink",
                   "Speak with Animals", "Thunderwave"],
    },
    "Sorcerer": {
        "cantrips": ["Acid Splash", "Chill Touch", "Dancing Lights", "Fire Bolt", "Light", "Mage Hand",
                     "Mending", "Message", "Minor Illusion", "Poison Spray", "Prestidigitation",
                     "Ray of Frost", "Shocking Grasp", "True Strike"],
        "level1": ["Burning Hands", "Charm Person", "Color Spray", "Comprehend Languages", "Detect Magic",
                   "Disguise Self", "Expeditious Retreat", "False Life", "Feather Fall", "Fog Cloud",
                   "Jump", "Mage Armor", "Magic Missile", "Shield", "Silent Image", "Sleep",
                   "Thunderwave"],
    },
    "Warlock": {
        "cantrips": ["Chill Touch", "Eldritch Blast", "Mage Hand", "Minor Illusion", "Poison Spray",
                     "Prestidigitation", "True Strike"],
        "level1": ["Charm Person", "Comprehend Languages", "Expeditious Retreat", "Hellish Rebuke",
                   "Illusory Script", "Protection from Evil and Good", "Unseen Servant"],
    },
    "Wizard": {
        "cantrips": ["Acid Splash", "Chill Touch", "Dancing Lights", "Fire Bolt", "Light", "Mage Hand",
                     "Mending", "Message", "Minor Illusion", "Poison Spray", "Prestidigitation",
                     "Ray of Frost", "Shocking Grasp", "True Strike"],
        "level1": ["Alarm", "Burning Hands", "Charm Person", "Color Spray", "Comprehend Languages",
                   "Detect Magic", "Disguise Self", "Expeditious Retreat", "False Life", "Feather Fall",
                   "Find Familiar", "Floating Disk", "Fog Cloud", "Grease", "Hideous Laughter",
                   "Identify", "Illusory Script", "Jump", "Longstrider", "Mage Armor", "Magic Missile",
                   "Protection from Evil and Good", "Shield", "Silent Image", "Sleep", "Thunderwave",
                   "Unseen Servant"],
    },
}

STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]


# ---------------------------------------------------------------------------
# GENERATION LOGIC
# ---------------------------------------------------------------------------

def modifier(score):
    return (score - 10) // 2


def fmt_mod(m):
    return f"+{m}" if m >= 0 else str(m)


def pick_race(rng, forced_race=None, forced_subrace=None):
    race_name = forced_race or rng.choice(list(RACES.keys()))
    race = RACES[race_name]
    subrace_name = None
    if race["subraces"]:
        subrace_name = forced_subrace or rng.choice(list(race["subraces"].keys()))
    return race_name, subrace_name


def assign_ability_scores(rng, class_data):
    """Assigns the standard array to abilities using a class-appropriate
    priority order. NOTE: this priority ordering is a generation
    convenience, not something the SRD specifies (see module docstring)."""
    values = sorted(STANDARD_ARRAY, reverse=True)
    priority = class_data["ability_priority"]
    return {ability: values[i] for i, ability in enumerate(priority)}


def apply_racial_ability_bonuses(rng, base_scores, race, subrace_data):
    scores = dict(base_scores)
    for ability, bonus in race.get("ability_bonus", {}).items():
        scores[ability] += bonus
    if subrace_data:
        for ability, bonus in subrace_data.get("ability_bonus", {}).items():
            scores[ability] += bonus
    choice_rule = race.get("ability_bonus_choice")
    if choice_rule:
        pool = [a for a in ABILITIES if a not in choice_rule.get("exclude", [])]
        chosen = rng.sample(pool, choice_rule["count"])
        for ability in chosen:
            scores[ability] += choice_rule["amount"]
    return scores


def choose_skills(rng, class_data, background_skills, race_skill_bonus, race_skill_choice):
    already = set(background_skills) | set(race_skill_bonus)
    chosen = set()

    if race_skill_choice:
        pool = race_skill_choice["pool"] or [s for s in ALL_SKILLS if s not in already]
        pool = [s for s in pool if s not in already and s not in chosen]
        n = min(race_skill_choice["count"], len(pool))
        chosen |= set(rng.sample(pool, n))

    class_choice = class_data["skill_choice"]
    pool = [s for s in class_choice["pool"] if s not in already and s not in chosen]
    n = min(class_choice["count"], len(pool))
    picked = set(rng.sample(pool, n)) if n > 0 else set()
    chosen |= picked
    # If overlap forced a shortfall (rare with this data set), top up from any
    # unclaimed skill, per the SRD's "choose a different proficiency of the
    # same kind instead" rule.
    shortfall = class_choice["count"] - len(picked)
    if shortfall > 0:
        remaining_pool = [s for s in ALL_SKILLS if s not in already and s not in chosen]
        if remaining_pool:
            chosen |= set(rng.sample(remaining_pool, min(shortfall, len(remaining_pool))))

    return sorted(chosen)


def choose_tool_proficiencies(rng, class_data, race, subrace_data):
    tools = []
    tp = class_data.get("tool_proficiencies")
    if isinstance(tp, list):
        tools.extend(tp)
    elif isinstance(tp, dict):
        choices = rng.sample(tp["pool"], tp["choose"])
        tools.extend(choices)
    if subrace_data and subrace_data.get("tool_proficiencies"):
        tools.extend(subrace_data["tool_proficiencies"])
    if race.get("tool_proficiency_choice"):
        tools.append(rng.choice(race["tool_proficiency_choice"]))
    return tools


def resolve_equipment(rng, equipment_options):
    resolved = []
    for entry in equipment_options:
        if "fixed" in entry:
            resolved.extend(entry["fixed"])
        elif "choose" in entry:
            resolved.append(rng.choice(entry["choose"]))
    return resolved


def lookup_item_stats(item_text):
    """Best-effort lookup of a chosen equipment string against the armor/
    weapon/pack tables, so the JSON output carries real stats instead of
    just flavor text."""
    text = item_text.lower()
    for name, data in ARMOR.items():
        if name.lower() in text:
            return {"type": "armor", "name": name, **data}
    for name, data in WEAPONS.items():
        if name.lower() in text.rstrip("s"):
            return {"type": "weapon", "name": name.title(), **data}
    for name, data in EQUIPMENT_PACKS.items():
        if name.lower().split("'")[0] in text:
            return {"type": "pack", "name": name, **data}
    return None


def compute_ac(scores, unarmored_defense, equipment_items):
    dex_mod = modifier(scores["DEX"])
    has_shield = any("shield" in item.lower() for item in equipment_items)
    worn_armor = None
    for item in equipment_items:
        stats = lookup_item_stats(item)
        if stats and stats["type"] == "armor":
            worn_armor = stats
            break

    if worn_armor:
        if worn_armor["category"] == "light":
            ac = worn_armor["base_ac"] + dex_mod
        elif worn_armor["category"] == "medium":
            ac = worn_armor["base_ac"] + min(dex_mod, 2)
        else:  # heavy
            ac = worn_armor["base_ac"]
        note = f"{worn_armor['name']} ({worn_armor['category']} armor)"
    elif unarmored_defense == "barbarian":
        ac = 10 + dex_mod + modifier(scores["CON"])
        note = "Unarmored Defense (barbarian): 10 + Dex mod + Con mod"
    elif unarmored_defense == "monk" and not has_shield:
        ac = 10 + dex_mod + modifier(scores["WIS"])
        note = "Unarmored Defense (monk): 10 + Dex mod + Wis mod"
    else:
        ac = 10 + dex_mod
        note = "Unarmored: 10 + Dex mod"

    if has_shield and not (unarmored_defense == "monk" and not worn_armor):
        ac += SHIELD_AC_BONUS
        note += " + shield (+2)"

    return ac, note


def compute_hp(scores, class_data, subrace_data):
    con_mod = modifier(scores["CON"])
    hp = class_data["hit_die"] + con_mod
    bonus_note = None
    if subrace_data and subrace_data.get("hp_bonus_per_level"):
        hp += subrace_data["hp_bonus_per_level"]
        bonus_note = "includes Dwarven Toughness (+1)"
    return hp, bonus_note


def build_spellcasting(rng, class_name, class_data, scores):
    spec = class_data.get("spellcasting")
    if not spec:
        return None
    spell_data = SPELLS[class_name]
    ability = spec["ability"]
    mod = modifier(scores[ability])
    save_dc = 8 + 2 + mod  # proficiency bonus is +2 at level 1
    attack_bonus = 2 + mod

    cantrips = rng.sample(spell_data["cantrips"], min(spec["cantrips_known"], len(spell_data["cantrips"])))
    result = {
        "ability": ability,
        "spell_save_dc": save_dc,
        "spell_attack_bonus": fmt_mod(attack_bonus),
        "cantrips_known": sorted(cantrips),
        "spell_slots": spec["slots"],
    }

    if spec["type"] == "known":
        known = rng.sample(spell_data["level1"], min(spec["spells_known"], len(spell_data["level1"])))
        result["spells_known"] = sorted(known)
    elif spec["type"] == "prepared":
        # SRD rule: Wisdom/Charisma modifier + class level (1), minimum of 1 spell.
        count = max(1, mod + 1)
        prepared = rng.sample(spell_data["level1"], min(count, len(spell_data["level1"])))
        result["spells_prepared"] = sorted(prepared)
        result["prepared_count_formula"] = f"{ability} modifier ({fmt_mod(mod)}) + class level (1), min 1"
    elif spec["type"] == "spellbook":
        book = rng.sample(spell_data["level1"], min(spec["spellbook_size"], len(spell_data["level1"])))
        prepared_count = max(1, mod + 1)
        result["spellbook"] = sorted(book)
        result["spells_prepared_today"] = sorted(rng.sample(book, min(prepared_count, len(book))))
        result["prepared_count_formula"] = f"{ability} modifier ({fmt_mod(mod)}) + class level (1), min 1"

    return result


def generate_character(rng, forced_race=None, forced_subrace=None, forced_class=None,
                        forced_alignment=None):
    class_name = forced_class or rng.choice(list(CLASSES.keys()))
    class_data = CLASSES[class_name]

    race_name, subrace_name = pick_race(rng, forced_race, forced_subrace)
    race = RACES[race_name]
    subrace_data = race["subraces"].get(subrace_name) if subrace_name else None

    base_scores = assign_ability_scores(rng, class_data)
    final_scores = apply_racial_ability_bonuses(rng, base_scores, race, subrace_data)

    background = BACKGROUND_ACOLYTE
    race_skill_bonus = race.get("skill_bonus", [])
    race_skill_choice = race.get("skill_choice")
    skills = choose_skills(rng, class_data, background["skill_proficiencies"],
                            race_skill_bonus, race_skill_choice)
    all_skill_proficiencies = sorted(
        set(skills) | set(race_skill_bonus) | set(background["skill_proficiencies"])
    )

    tool_profs = choose_tool_proficiencies(rng, class_data, race, subrace_data)

    weapon_profs = list(class_data["weapon_proficiencies"])
    if race.get("weapon_proficiencies"):
        weapon_profs.extend(race["weapon_proficiencies"])
    if subrace_data and subrace_data.get("weapon_proficiencies"):
        weapon_profs.extend(subrace_data["weapon_proficiencies"])

    class_equipment = resolve_equipment(rng, class_data["equipment_options"])
    all_equipment = class_equipment + list(background["equipment"])
    equipment_detail = []
    for item in class_equipment:
        stats = lookup_item_stats(item)
        equipment_detail.append({"item": item, "stats": stats} if stats else {"item": item})

    ac, ac_note = compute_ac(final_scores, class_data["unarmored_defense"], class_equipment)
    hp, hp_note = compute_hp(final_scores, class_data, subrace_data)

    languages = set(race["languages"])
    lang_choice_pool = [l for l in ALL_CHOOSABLE_LANGUAGES if l not in languages]
    if race.get("extra_language"):
        languages.add(rng.choice(lang_choice_pool))
        lang_choice_pool = [l for l in lang_choice_pool if l not in languages]
    if subrace_data and subrace_data.get("extra_language"):
        languages.add(rng.choice(lang_choice_pool))
        lang_choice_pool = [l for l in lang_choice_pool if l not in languages]
    n_bg_lang = min(background["language_choice"], len(lang_choice_pool))
    languages |= set(rng.sample(lang_choice_pool, n_bg_lang))

    racial_traits = list(race["traits"])
    if subrace_data:
        racial_traits += subrace_data.get("traits", [])

    draconic_ancestry = None
    if race_name == "Dragonborn":
        dragon_type = rng.choice(list(DRACONIC_ANCESTRY.keys()))
        draconic_ancestry = {"dragon": dragon_type, **DRACONIC_ANCESTRY[dragon_type]}

    high_elf_cantrip = None
    if subrace_name == "High Elf":
        high_elf_cantrip = rng.choice(SPELLS["Wizard"]["cantrips"])

    tiefling_cantrip = "Thaumaturgy" if race_name == "Tiefling" else None

    spellcasting = build_spellcasting(rng, class_name, class_data, final_scores)

    alignment = forced_alignment or rng.choice(ALIGNMENTS)

    ability_block = {}
    for ability in ABILITIES:
        score = final_scores[ability]
        ability_block[ability] = {"score": score, "modifier": fmt_mod(modifier(score))}

    saving_throws = {a: fmt_mod(modifier(final_scores[a]) + (2 if a in class_data["saving_throws"] else 0))
                      for a in ABILITIES}

    character = {
        "meta": {
            "source": "SRD 5.1 (Open Gaming License v1.0a), data extracted from the supplied project PDF",
            "level": 1,
            "note": "Ability-score assignment method and priority order are a generation "
                    "convenience not specified by the SRD; see script docstring.",
        },
        "race": race_name,
        "subrace": subrace_name,
        "class": class_name,
        "background": background["name"],
        "alignment": alignment,
        "ability_scores": ability_block,
        "proficiency_bonus": "+2",
        "saving_throws": saving_throws,
        "saving_throw_proficiencies": class_data["saving_throws"],
        "skill_proficiencies": all_skill_proficiencies,
        "armor_proficiencies": class_data["armor_proficiencies"],
        "weapon_proficiencies": sorted(set(weapon_profs)),
        "tool_proficiencies": tool_profs,
        "languages": sorted(languages),
        "hit_points": {"value": hp, "hit_die": f"1d{class_data['hit_die']}", "note": hp_note},
        "armor_class": {"value": ac, "calculation": ac_note},
        "speed": f"{race['speed']} ft.",
        "racial_traits": racial_traits,
        "draconic_ancestry": draconic_ancestry,
        "high_elf_bonus_cantrip": high_elf_cantrip,
        "tiefling_cantrip": tiefling_cantrip,
        "class_features_level_1": class_data["level1_features"],
        "spellcasting": spellcasting,
        "equipment": {
            "from_class": [e["item"] if isinstance(e, dict) else e for e in equipment_detail],
            "from_class_detail": equipment_detail,
            "from_background": background["equipment"],
        },
        "background_feature": background["feature"],
    }
    return character


def main():
    parser = argparse.ArgumentParser(description="Generate a random legal SRD 5.1 level-1 character.")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    parser.add_argument("--race", choices=list(RACES.keys()), default=None)
    parser.add_argument("--subrace", default=None)
    parser.add_argument("--class", dest="cls", choices=list(CLASSES.keys()), default=None)
    parser.add_argument("--alignment", choices=ALIGNMENTS, default=None)
    parser.add_argument("--out", default=None, help="Write JSON to this file instead of stdout")
    parser.add_argument("-n", "--count", type=int, default=1, help="Number of characters to generate")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    characters = [
        generate_character(rng, forced_race=args.race, forced_subrace=args.subrace,
                            forced_class=args.cls, forced_alignment=args.alignment)
        for _ in range(args.count)
    ]
    output = characters[0] if args.count == 1 else characters
    text = json.dumps(output, indent=2)

    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
    else:
        print(text)


if __name__ == "__main__":
    main()
