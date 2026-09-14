import equipmentData from "@/data/equipment.json";
import startingEquipmentData from "@/data/starting-equipment.json";
import type { Character, CharacterEquipment } from "@/training/types";
import { earnedArchetypes } from "@/training/features";
import type { ArmorDef } from "./armor";
import type { Weapon } from "./types";

export type { CharacterEquipment };

export function emptyEquipment(): CharacterEquipment {
  return { armor: null, mainHand: null, offHand: null, pack: null };
}

type EquipWeaponRow = {
  name: string;
  damage: { count: number; sides: number; type: string } | null;
  properties: string[];
};

type EquipArmorRow = {
  name: string;
  acStructured?: { base: number; dexCap: number | null };
  acBonus?: number;
  strengthRequirement?: number | null;
  /** e.g. ["metal"] for Shocking Grasp / similar checks. */
  material?: string[];
};

type EquipmentFile = {
  weapons: Record<string, Record<string, EquipWeaponRow>>;
  armor: Record<string, Record<string, EquipArmorRow>>;
};

type PackDef = { name: string; contents: string[]; cost?: string };

type MenuOption = {
  weaponId?: string;
  armorId?: string;
  packId?: string;
  item?: string;
  category?: string;
  withShield?: boolean;
  bundles?: MenuOption[];
};

type ClassMenu = {
  choices: { id: string; options: MenuOption[] }[];
  fixed: MenuOption[];
};

type StartingEquipmentFile = {
  packs: Record<string, PackDef>;
  classes: Record<string, ClassMenu>;
};

type Draft = CharacterEquipment & { pending: string[] };

const EQUIP = equipmentData as unknown as EquipmentFile;
const STARTING = startingEquipmentData as unknown as StartingEquipmentFile;

const CATEGORY_DEFAULTS: Record<string, string | string[]> = {
  "any simple weapon": "dagger",
  "any simple melee weapon": "dagger",
  "any martial melee weapon": "longsword",
  "a martial weapon": "longsword",
  "two simple melee weapons": ["dagger", "dagger"],
};

function equipId(id: string): string {
  return id.trim().toLowerCase().replace(/\s+/g, "_");
}

function asId(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

/** Case-insensitive append; returns a new array. */
function pushUnique(list: string[], item: string): string[] {
  const label = item.trim();
  if (!label) return list;
  const key = label.toLowerCase();
  if (list.some((c) => c.toLowerCase() === key)) return list;
  return [...list, label];
}

function mergeContents(a: string[], b: string[]): string[] {
  return b.reduce((acc, item) => pushUnique(acc, item), [...a]);
}

function parsePack(raw: unknown): CharacterEquipment["pack"] {
  if (Array.isArray(raw)) {
    const parts = raw.map(String);
    if (parts.length === 0) return null;
    const [name, ...contents] = parts;
    return { name: name || "Pack", contents };
  }
  if (raw && typeof raw === "object") {
    const pack = raw as { name?: unknown; contents?: unknown };
    return {
      name: pack.name != null ? String(pack.name) : "Pack",
      contents: Array.isArray(pack.contents) ? pack.contents.map(String) : [],
    };
  }
  return null;
}

function clonePack(
  pack: NonNullable<CharacterEquipment["pack"]>,
): NonNullable<CharacterEquipment["pack"]> {
  return { name: pack.name, contents: [...pack.contents] };
}

function findWeaponRow(id: string): EquipWeaponRow | undefined {
  const key = equipId(id);
  for (const group of Object.values(EQUIP.weapons)) {
    if (group[key]) return group[key];
  }
  return undefined;
}

function findArmorRow(
  id: string,
): { row: EquipArmorRow; category: string } | undefined {
  const key = equipId(id);
  for (const [category, group] of Object.entries(EQUIP.armor)) {
    if (category === "shield") continue;
    if (group[key]) return { row: group[key], category };
  }
  return undefined;
}

export function weaponFromEquipmentId(id: string): Weapon | null {
  const row = findWeaponRow(id);
  if (!row?.damage) return null;
  const properties = row.properties || [];
  return {
    name: row.name,
    damage: { count: row.damage.count, sides: row.damage.sides },
    damageType: row.damage.type,
    properties,
    finesse: properties.some((p) => /finesse/i.test(p)),
    ranged: properties.some((p) => /ammunition/i.test(p)),
  };
}

export function armorFromEquipmentId(id: string): ArmorDef | null {
  const found = findArmorRow(id);
  if (!found?.row.acStructured) return null;
  const cat = found.category as ArmorDef["category"];
  if (cat !== "light" && cat !== "medium" && cat !== "heavy") return null;
  return {
    name: found.row.name,
    category: cat,
    baseAC: found.row.acStructured.base,
    dexCap: found.row.acStructured.dexCap,
    strRequirement: found.row.strengthRequirement ?? null,
    material: [...(found.row.material ?? [])],
  };
}

/**
 * True when the armor id’s catalog `material` includes `"metal"`.
 * Missing/unknown ids and shields are false.
 */
export function isMetalArmorId(id: string | null | undefined): boolean {
  if (!id) return false;
  const key = equipId(id);
  const found = findArmorRow(key);
  if (!found) return false;
  return (found.row.material ?? []).includes("metal");
}

export function shieldAcBonus(): number {
  return EQUIP.armor.shield?.shield?.acBonus ?? 2;
}

export function equipmentDisplayName(id: string): string {
  if (id === "shield") return "Shield";
  const weapon = findWeaponRow(id);
  if (weapon) return weapon.name;
  const armor = findArmorRow(id);
  if (armor) return armor.row.name;
  return id
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function equipmentSheetRows(
  eq: CharacterEquipment | null | undefined,
): { slot: string; name: string; detail?: string }[] {
  const gear = normalizeEquipment(eq);
  const rows: { slot: string; name: string; detail?: string }[] = [];
  if (gear.armor) {
    rows.push({ slot: "Armor", name: equipmentDisplayName(gear.armor) });
  }
  if (gear.mainHand) {
    rows.push({
      slot: "Main hand",
      name: equipmentDisplayName(gear.mainHand),
    });
  }
  if (gear.offHand) {
    rows.push({
      slot: "Off hand",
      name: equipmentDisplayName(gear.offHand),
    });
  }
  if (gear.pack) {
    rows.push({
      slot: "Pack",
      name: gear.pack.name,
      detail: gear.pack.contents.length
        ? gear.pack.contents.join(", ")
        : undefined,
    });
  }
  return rows;
}

function setIfEmpty<K extends "armor" | "mainHand" | "offHand">(
  draft: Draft,
  slot: K,
  value: string,
): void {
  if (draft[slot] == null) draft[slot] = value;
}

/** Overflow goes into pack.contents; queue until a pack exists. */
function appendOverflow(draft: Draft, item: string): void {
  if (draft.pack) {
    draft.pack.contents = pushUnique(draft.pack.contents, item);
  } else {
    draft.pending = pushUnique(draft.pending, item);
  }
}

function flushPending(draft: Draft): void {
  if (draft.pending.length === 0) return;
  if (!draft.pack) {
    draft.pack = { name: "Carried", contents: [...draft.pending] };
  } else {
    draft.pack.contents = mergeContents(draft.pack.contents, draft.pending);
  }
  draft.pending = [];
}

function applyWeaponId(draft: Draft, weaponId: string): void {
  const row = findWeaponRow(weaponId);
  if (!row) return;
  const id = equipId(weaponId);
  if (draft.mainHand == null) draft.mainHand = id;
  else if (draft.offHand == null) draft.offHand = id;
  else appendOverflow(draft, row.name || id);
}

function applyArmorId(draft: Draft, armorId: string): void {
  if (!findArmorRow(armorId)) return;
  setIfEmpty(draft, "armor", equipId(armorId));
}

function applyPackId(draft: Draft, packId: string): void {
  if (draft.pack) return;
  const pack =
    STARTING.packs[packId] || STARTING.packs[equipId(packId)];
  if (!pack) return;
  draft.pack = { name: pack.name, contents: [...pack.contents] };
  flushPending(draft);
}

function applyNamedItem(draft: Draft, item: string): void {
  const trimmed = item.trim();
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  if (lower === "shield" || lower === "wooden shield") {
    setIfEmpty(draft, "offHand", "shield");
    return;
  }
  if (findWeaponRow(trimmed)) {
    applyWeaponId(draft, trimmed);
    return;
  }
  if (findArmorRow(trimmed)) {
    applyArmorId(draft, trimmed);
    return;
  }
  appendOverflow(draft, trimmed);
}

function applyOption(draft: Draft, opt: MenuOption): void {
  if (opt.bundles?.length) {
    for (const part of opt.bundles) applyOption(draft, part);
    if (opt.withShield) setIfEmpty(draft, "offHand", "shield");
    return;
  }

  if (opt.weaponId) applyWeaponId(draft, opt.weaponId);
  if (opt.armorId) applyArmorId(draft, opt.armorId);
  if (opt.packId) applyPackId(draft, opt.packId);

  if (opt.category) {
    const mapped = CATEGORY_DEFAULTS[opt.category];
    if (typeof mapped === "string") applyWeaponId(draft, mapped);
    else if (Array.isArray(mapped)) {
      for (const w of mapped) applyWeaponId(draft, w);
    } else {
      appendOverflow(draft, opt.category);
    }
  }

  if (opt.item) applyNamedItem(draft, opt.item);
  if (opt.withShield) setIfEmpty(draft, "offHand", "shield");
}

/**
 * First-option resolution for one archetype (primary class only).
 * Overflow before pack is queued, then flushed into pack.contents.
 */
export function resolveDefaultLoadout(archetype: string): CharacterEquipment {
  const menu = STARTING.classes[archetype];
  if (!menu) return emptyEquipment();

  const draft: Draft = { ...emptyEquipment(), pending: [] };
  for (const choice of menu.choices || []) {
    const first = choice.options?.[0];
    if (first) applyOption(draft, first);
  }
  for (const grant of menu.fixed || []) applyOption(draft, grant);
  flushPending(draft);

  return {
    armor: draft.armor,
    mainHand: draft.mainHand,
    offHand: draft.offHand,
    pack: draft.pack ? clonePack(draft.pack) : null,
  };
}

/** Fill null slots only; merge pack contents additively. */
export function mergeEquipmentSlots(
  current: CharacterEquipment | null | undefined,
  incoming: CharacterEquipment,
): CharacterEquipment {
  const base = normalizeEquipment(current);
  const inc = normalizeEquipment(incoming);

  let pack: CharacterEquipment["pack"] = null;
  if (base.pack && inc.pack) {
    pack = {
      name: base.pack.name || inc.pack.name,
      contents: mergeContents(base.pack.contents, inc.pack.contents),
    };
  } else if (base.pack) {
    pack = clonePack(base.pack);
  } else if (inc.pack) {
    pack = clonePack(inc.pack);
  }

  return {
    armor: base.armor ?? inc.armor,
    mainHand: base.mainHand ?? inc.mainHand,
    offHand: base.offHand ?? inc.offHand,
    pack,
  };
}

/**
 * Coerce legacy array inventory / partial objects into the 4-field shape.
 * Trailing array slots and any `other` field fold into pack.contents.
 */
export function normalizeEquipment(
  raw: CharacterEquipment | unknown[] | Record<string, unknown> | null | undefined,
): CharacterEquipment {
  if (!raw) return emptyEquipment();

  if (Array.isArray(raw)) {
    const out = emptyEquipment();
    out.armor = asId(raw[0]);
    out.mainHand = asId(raw[1]);
    out.offHand = asId(raw[2]);
    out.pack = parsePack(raw[3]);
    const overflow = raw
      .slice(4)
      .filter((v): v is string => typeof v === "string" && !!v);
    if (overflow.length) {
      out.pack ??= { name: "Carried", contents: [] };
      out.pack.contents = mergeContents(out.pack.contents, overflow);
    }
    return out;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const out: CharacterEquipment = {
      armor: asId(obj.armor),
      mainHand: asId(obj.mainHand),
      offHand: asId(obj.offHand),
      pack: parsePack(obj.pack),
    };
    const extra: string[] = [];
    if (typeof obj.other === "string" && obj.other) extra.push(obj.other);
    if (Array.isArray(obj.other)) {
      for (const v of obj.other) if (v != null && v !== "") extra.push(String(v));
    }
    if (extra.length) {
      out.pack ??= { name: "Carried", contents: [] };
      out.pack.contents = mergeContents(out.pack.contents, extra);
    }
    return out;
  }

  return emptyEquipment();
}

/** Outfit empty slots from the character's first-earned archetype. */
export function ensureCharacterEquipment(ch: Character): Character {
  const primary = earnedArchetypes(ch)[0];
  if (!primary) {
    return { ...ch, equipment: normalizeEquipment(ch.equipment) };
  }
  return {
    ...ch,
    equipment: mergeEquipmentSlots(
      ch.equipment,
      resolveDefaultLoadout(primary),
    ),
  };
}
