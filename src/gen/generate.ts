import { abilityMod } from "@/sim/rules";
import { createRng, pick, sample, type Rng } from "@/sim/rng";
import type { Ability, SrdCharacter } from "@/sim/types";
import {
  ABILITIES,
  ALIGNMENTS,
  ALL_CHOOSABLE_LANGUAGES,
  ALL_SKILLS,
  ARMOR,
  BACKGROUND_ACOLYTE,
  CLASS_NAMES,
  CLASSES,
  DRACONIC_ANCESTRY,
  EQUIPMENT_PACKS,
  HEALER_CLASSES,
  RACES,
  SHIELD_AC_BONUS,
  SPELLS,
  STANDARD_ARRAY,
  TANK_CLASSES,
  WEAPONS,
  type ClassData,
  type ItemStats,
  type RaceData,
  type SkillChoice,
  type SubraceData,
  type ToolChoice,
} from "./data";
import type { PartyGenOptions } from "./params";

const NAMES = [
  "Pip",
  "Bramble",
  "Vessa",
  "Jorik",
  "Faelar",
  "Lyra",
  "Oren",
  "Nix",
  "Kestrel",
  "Thorn",
  "Mira",
  "Cade",
  "Rowan",
  "Sable",
  "Ivo",
  "Wren",
  "Tamsin",
  "Garr",
  "Ash",
  "Perrin",
  "Nyx",
  "Bram",
  "Sera",
  "Lute",
];

function fmtMod(m: number): string {
  return m >= 0 ? `+${m}` : String(m);
}

function isToolChoice(tp: ClassData["tool_proficiencies"]): tp is ToolChoice {
  return !Array.isArray(tp);
}

function pickRace(
  rng: Rng,
  forcedRace?: string,
  forcedSubrace?: string,
): { raceName: string; subraceName: string | null } {
  const raceName = forcedRace ?? pick(rng, Object.keys(RACES));
  const race = RACES[raceName]!;
  const subKeys = Object.keys(race.subraces);
  const subraceName = subKeys.length
    ? (forcedSubrace ?? pick(rng, subKeys))
    : null;
  return { raceName, subraceName };
}

function assignAbilityScores(classData: ClassData): Record<Ability, number> {
  const values = [...STANDARD_ARRAY].sort((a, b) => b - a);
  const scores = {} as Record<Ability, number>;
  classData.ability_priority.forEach((ability, i) => {
    scores[ability] = values[i]!;
  });
  return scores;
}

function applyRacialAbilityBonuses(
  rng: Rng,
  base: Record<Ability, number>,
  race: RaceData,
  subrace: SubraceData | null,
): Record<Ability, number> {
  const scores = { ...base };
  for (const [ability, bonus] of Object.entries(race.ability_bonus)) {
    scores[ability as Ability] += bonus ?? 0;
  }
  if (subrace?.ability_bonus) {
    for (const [ability, bonus] of Object.entries(subrace.ability_bonus)) {
      scores[ability as Ability] += bonus ?? 0;
    }
  }
  const choice = race.ability_bonus_choice;
  if (choice) {
    const pool = ABILITIES.filter((a) => !choice.exclude.includes(a));
    for (const ability of sample(rng, pool, choice.count)) {
      scores[ability] += choice.amount;
    }
  }
  return scores;
}

function chooseSkills(
  rng: Rng,
  classData: ClassData,
  backgroundSkills: string[],
  raceSkillBonus: string[],
  raceSkillChoice?: SkillChoice,
): string[] {
  const already = new Set([...backgroundSkills, ...raceSkillBonus]);
  const chosen = new Set<string>();

  if (raceSkillChoice) {
    const rawPool = raceSkillChoice.pool ?? ALL_SKILLS.filter((s) => !already.has(s));
    const pool = rawPool.filter((s) => !already.has(s) && !chosen.has(s));
    const n = Math.min(raceSkillChoice.count, pool.length);
    for (const s of sample(rng, pool, n)) chosen.add(s);
  }

  const classPool = classData.skill_choice.pool.filter(
    (s) => !already.has(s) && !chosen.has(s),
  );
  const n = Math.min(classData.skill_choice.count, classPool.length);
  const picked = n > 0 ? sample(rng, classPool, n) : [];
  for (const s of picked) chosen.add(s);

  const shortfall = classData.skill_choice.count - picked.length;
  if (shortfall > 0) {
    const remaining = ALL_SKILLS.filter((s) => !already.has(s) && !chosen.has(s));
    for (const s of sample(rng, remaining, Math.min(shortfall, remaining.length))) {
      chosen.add(s);
    }
  }

  return [...chosen].sort();
}

function chooseToolProficiencies(
  rng: Rng,
  classData: ClassData,
  race: RaceData,
  subrace: SubraceData | null,
): string[] {
  const tools: string[] = [];
  const tp = classData.tool_proficiencies;
  if (isToolChoice(tp)) {
    tools.push(...sample(rng, tp.pool, tp.choose));
  } else {
    tools.push(...tp);
  }
  if (subrace?.tool_proficiencies) tools.push(...subrace.tool_proficiencies);
  if (race.tool_proficiency_choice) {
    tools.push(pick(rng, race.tool_proficiency_choice));
  }
  return tools;
}

function resolveEquipment(rng: Rng, options: ClassData["equipment_options"]): string[] {
  const resolved: string[] = [];
  for (const entry of options) {
    if ("fixed" in entry) resolved.push(...entry.fixed);
    else resolved.push(pick(rng, entry.choose));
  }
  return resolved;
}

function lookupItemStats(
  itemText: string,
): ({ type: "armor" | "weapon" | "pack"; name: string } & ItemStats) | null {
  const text = itemText.toLowerCase();
  for (const [name, data] of Object.entries(ARMOR)) {
    if (text.includes(name.toLowerCase())) {
      return { type: "armor", name, ...data };
    }
  }
  const stripped = text.replace(/s+$/, "");
  for (const [name, data] of Object.entries(WEAPONS)) {
    if (stripped.includes(name.toLowerCase())) {
      return { type: "weapon", name: titleCaseWeapon(name), ...data };
    }
  }
  for (const [name, data] of Object.entries(EQUIPMENT_PACKS)) {
    if (text.includes(name.toLowerCase().split("'")[0]!)) {
      return { type: "pack", name, ...data };
    }
  }
  return null;
}

function titleCaseWeapon(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeAc(
  scores: Record<Ability, number>,
  unarmored: ClassData["unarmored_defense"],
  equipmentItems: string[],
): { ac: number; note: string } {
  const dexMod = abilityMod(scores.DEX);
  const hasShield = equipmentItems.some((item) => item.toLowerCase().includes("shield"));
  let wornArmor: (ItemStats & { name: string }) | null = null;
  for (const item of equipmentItems) {
    const stats = lookupItemStats(item);
    if (stats?.type === "armor") {
      wornArmor = stats;
      break;
    }
  }

  let ac: number;
  let note: string;
  if (wornArmor) {
    if (wornArmor.category === "light") ac = (wornArmor.base_ac ?? 10) + dexMod;
    else if (wornArmor.category === "medium") {
      ac = (wornArmor.base_ac ?? 10) + Math.min(dexMod, 2);
    } else ac = wornArmor.base_ac ?? 10;
    note = `${wornArmor.name} (${wornArmor.category} armor)`;
  } else if (unarmored === "barbarian") {
    ac = 10 + dexMod + abilityMod(scores.CON);
    note = "Unarmored Defense (barbarian): 10 + Dex mod + Con mod";
  } else if (unarmored === "monk" && !hasShield) {
    ac = 10 + dexMod + abilityMod(scores.WIS);
    note = "Unarmored Defense (monk): 10 + Dex mod + Wis mod";
  } else {
    ac = 10 + dexMod;
    note = "Unarmored: 10 + Dex mod";
  }

  if (hasShield && !(unarmored === "monk" && !wornArmor)) {
    ac += SHIELD_AC_BONUS;
    note += " + shield (+2)";
  }
  return { ac, note };
}

function computeHp(
  scores: Record<Ability, number>,
  classData: ClassData,
  subrace: SubraceData | null,
): { hp: number; note: string | null } {
  let hp = classData.hit_die + abilityMod(scores.CON);
  let note: string | null = null;
  if (subrace?.hp_bonus_per_level) {
    hp += subrace.hp_bonus_per_level;
    note = "includes Dwarven Toughness (+1)";
  }
  return { hp, note };
}

function buildSpellcasting(
  rng: Rng,
  className: string,
  classData: ClassData,
  scores: Record<Ability, number>,
): SrdCharacter["spellcasting"] {
  const spec = classData.spellcasting;
  if (!spec) return null;
  const spellData = SPELLS[className]!;
  const ability = spec.ability;
  const mod = abilityMod(scores[ability]);
  const saveDc = 8 + 2 + mod;
  const attackBonus = 2 + mod;
  const cantrips = sample(
    rng,
    spellData.cantrips,
    Math.min(spec.cantrips_known, spellData.cantrips.length),
  ).sort();

  const result: NonNullable<SrdCharacter["spellcasting"]> & Record<string, unknown> = {
    ability,
    spell_save_dc: saveDc,
    spell_attack_bonus: fmtMod(attackBonus),
    cantrips_known: cantrips,
    spell_slots: spec.slots,
  };

  if (spec.type === "known") {
    result.spells_known = sample(
      rng,
      spellData.level1,
      Math.min(spec.spells_known ?? 0, spellData.level1.length),
    ).sort();
  } else if (spec.type === "prepared") {
    const count = Math.max(1, mod + 1);
    result.spells_prepared = sample(
      rng,
      spellData.level1,
      Math.min(count, spellData.level1.length),
    ).sort();
    result.prepared_count_formula = `${ability} modifier (${fmtMod(mod)}) + class level (1), min 1`;
  } else {
    const book = sample(
      rng,
      spellData.level1,
      Math.min(spec.spellbook_size ?? 0, spellData.level1.length),
    ).sort();
    const preparedCount = Math.max(1, mod + 1);
    result.spellbook = book;
    result.spells_prepared_today = sample(
      rng,
      book,
      Math.min(preparedCount, book.length),
    ).sort();
    result.prepared_count_formula = `${ability} modifier (${fmtMod(mod)}) + class level (1), min 1`;
  }

  return result;
}

export function generateCharacter(
  rng: Rng,
  forced: {
    class?: string;
    race?: string;
    subrace?: string;
    alignment?: string;
  } = {},
): SrdCharacter {
  const className = forced.class ?? pick(rng, CLASS_NAMES);
  const classData = CLASSES[className]!;
  const { raceName, subraceName } = pickRace(rng, forced.race, forced.subrace);
  const race = RACES[raceName]!;
  const subrace = subraceName ? race.subraces[subraceName]! : null;

  const baseScores = assignAbilityScores(classData);
  const finalScores = applyRacialAbilityBonuses(rng, baseScores, race, subrace);

  const background = BACKGROUND_ACOLYTE;
  const raceSkillBonus = race.skill_bonus ?? [];
  const skills = chooseSkills(
    rng,
    classData,
    background.skill_proficiencies,
    raceSkillBonus,
    race.skill_choice,
  );
  const allSkillProficiencies = [
    ...new Set([
      ...skills,
      ...raceSkillBonus,
      ...background.skill_proficiencies,
    ]),
  ].sort();

  const toolProfs = chooseToolProficiencies(rng, classData, race, subrace);
  const weaponProfs = [
    ...classData.weapon_proficiencies,
    ...(race.weapon_proficiencies ?? []),
    ...(subrace?.weapon_proficiencies ?? []),
  ];

  const classEquipment = resolveEquipment(rng, classData.equipment_options);
  const equipmentDetail = classEquipment.map((item) => {
    const stats = lookupItemStats(item);
    return stats
      ? {
          item,
          stats: {
            type: stats.type,
            name: stats.name,
            damage: stats.damage,
            properties: stats.properties,
          },
        }
      : { item };
  });

  const { ac, note: acNote } = computeAc(
    finalScores,
    classData.unarmored_defense,
    classEquipment,
  );
  const { hp, note: hpNote } = computeHp(finalScores, classData, subrace);

  const languages = new Set(race.languages);
  let langPool = ALL_CHOOSABLE_LANGUAGES.filter((l) => !languages.has(l));
  if (race.extra_language) {
    languages.add(pick(rng, langPool));
    langPool = langPool.filter((l) => !languages.has(l));
  }
  if (subrace?.extra_language) {
    languages.add(pick(rng, langPool));
    langPool = langPool.filter((l) => !languages.has(l));
  }
  const nBgLang = Math.min(background.language_choice, langPool.length);
  for (const l of sample(rng, langPool, nBgLang)) languages.add(l);

  const racialTraits = [...race.traits, ...(subrace?.traits ?? [])];

  let draconicAncestry: SrdCharacter["draconic_ancestry"] = null;
  if (raceName === "Dragonborn") {
    const dragon = pick(rng, Object.keys(DRACONIC_ANCESTRY));
    draconicAncestry = { dragon, ...DRACONIC_ANCESTRY[dragon]! };
  }

  const highElfCantrip =
    subraceName === "High Elf" ? pick(rng, SPELLS.Wizard!.cantrips) : null;
  const tieflingCantrip = raceName === "Tiefling" ? "Thaumaturgy" : null;
  const spellcasting = buildSpellcasting(rng, className, classData, finalScores);
  const alignment = forced.alignment ?? pick(rng, ALIGNMENTS);

  const abilityBlock = {} as SrdCharacter["ability_scores"];
  for (const ability of ABILITIES) {
    const score = finalScores[ability];
    abilityBlock[ability] = { score, modifier: fmtMod(abilityMod(score)) };
  }

  const savingThrows = Object.fromEntries(
    ABILITIES.map((a) => [
      a,
      fmtMod(
        abilityMod(finalScores[a]) +
          (classData.saving_throws.includes(a) ? 2 : 0),
      ),
    ]),
  );

  return {
    meta: {
      source:
        "SRD 5.1 (Open Gaming License v1.0a), data extracted from the supplied project PDF",
      level: 1,
      note: "Ability-score assignment method and priority order are a generation convenience not specified by the SRD; see script docstring.",
    },
    race: raceName,
    subrace: subraceName,
    class: className,
    background: background.name,
    alignment,
    ability_scores: abilityBlock,
    proficiency_bonus: "+2",
    saving_throws: savingThrows,
    saving_throw_proficiencies: classData.saving_throws,
    skill_proficiencies: allSkillProficiencies,
    armor_proficiencies: classData.armor_proficiencies,
    weapon_proficiencies: [...new Set(weaponProfs)].sort(),
    tool_proficiencies: toolProfs,
    languages: [...languages].sort(),
    hit_points: {
      value: hp,
      hit_die: `1d${classData.hit_die}`,
      note: hpNote,
    },
    armor_class: { value: ac, calculation: acNote },
    speed: `${race.speed} ft.`,
    racial_traits: racialTraits,
    draconic_ancestry: draconicAncestry,
    high_elf_bonus_cantrip: highElfCantrip,
    tiefling_cantrip: tieflingCantrip,
    class_features_level_1: classData.level1_features,
    spellcasting,
    equipment: {
      from_class: equipmentDetail.map((e) => e.item),
      from_class_detail: equipmentDetail,
      from_background: background.equipment,
    },
    background_feature: background.feature,
  };
}

function pickPartyClasses(rng: Rng, opts: PartyGenOptions): string[] {
  if (opts.class) {
    return Array.from({ length: opts.count }, () => opts.class!);
  }
  if (opts.balanced && opts.count >= 2) {
    const tank = pick(rng, [...TANK_CLASSES]);
    const healer = pick(rng, [...HEALER_CLASSES]);
    const rest = Array.from({ length: opts.count - 2 }, () =>
      pick(rng, CLASS_NAMES),
    );
    return [tank, healer, ...rest];
  }
  return Array.from({ length: opts.count }, () => pick(rng, CLASS_NAMES));
}

export function generateParty(opts: PartyGenOptions): SrdCharacter[] {
  const rng = createRng(opts.partySeed);
  const classes = pickPartyClasses(rng, opts);
  const party = classes.map((className) =>
    generateCharacter(rng, {
      class: className,
      race: opts.race,
      subrace: opts.subrace,
      alignment: opts.alignment,
    }),
  );
  if (opts.names) {
    const picked = sample(rng, NAMES, party.length);
    party.forEach((ch, i) => {
      ch.name = picked[i];
    });
  }
  return party;
}
