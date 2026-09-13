import equipmentData from "@/data/equipment.json";
import startingEquipmentData from "@/data/starting-equipment.json";
import type { Character } from "@/training/types";
import { earnedArchetypes } from "@/training/features";
import type { ArmorDef } from "./armor";
import type { Weapon } from "./types";

/**
 * Four named inventory fields — not a keyed collection.
 * Overflow (unmodeled items, etc.) appends into pack.contents.
 */
export type CharacterEquipment = {
  armor: string | null;
  mainHand: string | null;
  offHand: string | null;
  pack: { name: string; contents: string[] } | null;
};

export function emptyEquipment(): CharacterEquipment {
  return {
    armor: null,
    mainHand: null,
    offHand: null,
    pack: null,
  };
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

/** Mutable resolution state: overflow queues until pack is set. */
type LoadoutDraft = CharacterEquipment & { pendingOverflow: string[] };

const EQUIP = equipmentData as unknown as EquipmentFile;
const STARTING = startingEquipmentData as unknown as StartingEquipmentFile;

/** Normalize menu ids ("chain mail") to equipment.json keys ("chain_mail"). */
export function normalizeEquipId(id: string): string {
  return id.trim().toLowerCase().replace(/\s+/g, "_");
}

function findWeaponRow(id: string): EquipWeaponRow | undefined {
  const key = normalizeEquipId(id);
  for (const group of Object.values(EQUIP.weapons)) {
    if (group[key]) return group[key];
  }
  return undefined;
}

function findArmorRow(
  id: string,
): { row: EquipArmorRow; category: string } | undefined {
  const key = normalizeEquipId(id);
  for (const [category, group] of Object.entries(EQUIP.armor)) {
    if (category === "shield") continue;
    if (group[key]) return { row: group[key], category };
  }
  return undefined;
}

/** Resolve a weapon id from equipment.json into a sim Weapon. */
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

/** Resolve an armor id from equipment.json into ArmorDef. */
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
    strRequirement: null,
  };
}

export function shieldAcBonus(): number {
  return EQUIP.armor.shield?.shield?.acBonus ?? 2;
}

/** Human-readable name for a stored equipment id (or the literal "shield"). */
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

/** Sheet-ready rows for the four named slots (omits empty). */
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

const CATEGORY_DEFAULTS: Record<string, string | string[]> = {
  "any simple weapon": "dagger",
  "any simple melee weapon": "dagger",
  "any martial melee weapon": "longsword",
  "a martial weapon": "longsword",
  "two simple melee weapons": ["dagger", "dagger"],
};

function setIfEmpty<K extends "armor" | "mainHand" | "offHand">(
  draft: LoadoutDraft,
  slot: K,
  value: string,
): void {
  if (draft[slot] == null) draft[slot] = value;
}

/** Append into pack.contents; queue if pack is not resolved yet. */
function appendOverflow(draft: LoadoutDraft, item: string): void {
  const label = item.trim();
  if (!label) return;
  const lower = label.toLowerCase();
  if (draft.pack) {
    if (draft.pack.contents.some((c) => c.toLowerCase() === lower)) return;
    draft.pack.contents.push(label);
    return;
  }
  if (draft.pendingOverflow.some((c) => c.toLowerCase() === lower)) return;
  draft.pendingOverflow.push(label);
}

function flushPendingOverflow(draft: LoadoutDraft): void {
  if (draft.pendingOverflow.length === 0) return;
  if (!draft.pack) {
    // No pack choice resolved (unusual) — still keep overflow items.
    draft.pack = { name: "Carried", contents: [...draft.pendingOverflow] };
  } else {
    for (const item of draft.pendingOverflow) {
      const lower = item.toLowerCase();
      if (!draft.pack.contents.some((c) => c.toLowerCase() === lower)) {
        draft.pack.contents.push(item);
      }
    }
  }
  draft.pendingOverflow = [];
}

function applyWeaponId(draft: LoadoutDraft, weaponId: string): void {
  if (!findWeaponRow(weaponId)) return;
  const id = normalizeEquipId(weaponId);
  if (draft.mainHand == null) {
    draft.mainHand = id;
  } else if (draft.offHand == null) {
    draft.offHand = id;
  } else {
    appendOverflow(draft, findWeaponRow(weaponId)?.name || id);
  }
}

function applyArmorId(draft: LoadoutDraft, armorId: string): void {
  if (!findArmorRow(armorId)) return;
  setIfEmpty(draft, "armor", normalizeEquipId(armorId));
}

function applyPackId(draft: LoadoutDraft, packId: string): void {
  if (draft.pack != null) return;
  const pack =
    STARTING.packs[packId] || STARTING.packs[normalizeEquipId(packId)];
  if (!pack) return;
  draft.pack = {
    name: pack.name,
    contents: [...pack.contents],
  };
  flushPendingOverflow(draft);
}

function applyNamedItem(draft: LoadoutDraft, item: string): void {
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

function applyOption(draft: LoadoutDraft, opt: MenuOption): void {
  if (opt.bundles && opt.bundles.length > 0) {
    for (const part of opt.bundles) applyOption(draft, part);
    if (opt.withShield) setIfEmpty(draft, "offHand", "shield");
    return;
  }

  if (opt.weaponId) applyWeaponId(draft, opt.weaponId);
  if (opt.armorId) applyArmorId(draft, opt.armorId);
  if (opt.packId) applyPackId(draft, opt.packId);

  if (opt.category) {
    const mapped = CATEGORY_DEFAULTS[opt.category];
    if (typeof mapped === "string") {
      applyWeaponId(draft, mapped);
    } else if (Array.isArray(mapped)) {
      for (const w of mapped) applyWeaponId(draft, w);
    } else {
      // Unmapped category (e.g. musical instrument) → pack.contents.
      appendOverflow(draft, opt.category);
    }
  }

  if (opt.item) applyNamedItem(draft, opt.item);

  if (opt.withShield) setIfEmpty(draft, "offHand", "shield");
}

/**
 * First-option resolution of starting-equipment.json for one archetype.
 * Multi-archetype characters should pass only their primary (first-earned) class.
 *
 * Resolution order is choices (in file order) then fixed grants. Overflow items
 * that arrive before a pack is set are queued, then flushed into pack.contents
 * when the pack resolves (or into a synthetic "Carried" pack at the end).
 */
export function resolveDefaultLoadout(archetype: string): CharacterEquipment {
  const draft: LoadoutDraft = {
    ...emptyEquipment(),
    pendingOverflow: [],
  };
  const menu = STARTING.classes[archetype];
  if (!menu) return emptyEquipment();

  for (const choice of menu.choices || []) {
    const first = choice.options?.[0];
    if (first) applyOption(draft, first);
  }
  for (const grant of menu.fixed || []) {
    applyOption(draft, grant);
  }
  flushPendingOverflow(draft);

  return {
    armor: draft.armor,
    mainHand: draft.mainHand,
    offHand: draft.offHand,
    pack: draft.pack
      ? { name: draft.pack.name, contents: [...draft.pack.contents] }
      : null,
  };
}

function mergePackContents(
  base: string[],
  incoming: string[],
): string[] {
  const out = [...base];
  const seen = new Set(base.map((s) => s.toLowerCase()));
  for (const item of incoming) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Fill only currently-null fixed slots; merge pack contents additively. */
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
      contents: mergePackContents(base.pack.contents, inc.pack.contents),
    };
  } else {
    pack = base.pack ?? (inc.pack ? { ...inc.pack, contents: [...inc.pack.contents] } : null);
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
 * Array trailing slots and any Record "other" leftovers fold into pack.contents.
 */
export function normalizeEquipment(
  raw: CharacterEquipment | unknown[] | Record<string, unknown> | null | undefined,
): CharacterEquipment {
  if (!raw) return emptyEquipment();

  // Legacy array: [armor, mainHand, offHand, pack|null, ...overflow]
  if (Array.isArray(raw)) {
    const out = emptyEquipment();
    const overflow: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (i === 0) {
        out.armor = v == null || v === "" ? null : String(v);
      } else if (i === 1) {
        out.mainHand = v == null || v === "" ? null : String(v);
      } else if (i === 2) {
        out.offHand = v == null || v === "" ? null : String(v);
      } else if (i === 3) {
        if (Array.isArray(v)) {
          const [name, ...contents] = v.map(String);
          out.pack = {
            name: name || "Pack",
            contents,
          };
        } else if (v && typeof v === "object") {
          const pack = v as { name?: unknown; contents?: unknown };
          out.pack = {
            name: pack.name != null ? String(pack.name) : "Pack",
            contents: Array.isArray(pack.contents)
              ? pack.contents.map(String)
              : [],
          };
        }
      } else if (typeof v === "string" && v) {
        overflow.push(v);
      }
    }
    if (overflow.length) {
      if (!out.pack) out.pack = { name: "Carried", contents: [] };
      out.pack.contents = mergePackContents(out.pack.contents, overflow);
    }
    return out;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const out = emptyEquipment();
    out.armor =
      obj.armor == null || obj.armor === "" ? null : String(obj.armor);
    out.mainHand =
      obj.mainHand == null || obj.mainHand === ""
        ? null
        : String(obj.mainHand);
    out.offHand =
      obj.offHand == null || obj.offHand === "" ? null : String(obj.offHand);

    if (Array.isArray(obj.pack)) {
      const [name, ...contents] = obj.pack.map(String);
      out.pack = { name: name || "Pack", contents };
    } else if (obj.pack && typeof obj.pack === "object") {
      const pack = obj.pack as { name?: unknown; contents?: unknown };
      out.pack = {
        name: pack.name != null ? String(pack.name) : "Pack",
        contents: Array.isArray(pack.contents)
          ? pack.contents.map(String)
          : [],
      };
    }

    // Collapse any mistaken keyed "other" / dynamic overflow into pack.contents.
    const extra: string[] = [];
    if (typeof obj.other === "string" && obj.other) extra.push(obj.other);
    if (Array.isArray(obj.other)) {
      for (const v of obj.other) if (v != null) extra.push(String(v));
    }
    if (extra.length) {
      if (!out.pack) out.pack = { name: "Carried", contents: [] };
      out.pack.contents = mergePackContents(out.pack.contents, extra);
    }
    return out;
  }

  return emptyEquipment();
}

/** @deprecated alias — prefer normalizeEquipment */
export const normalizeInventory = normalizeEquipment;

/**
 * Fill empty inventory slots from the character's primary (first-earned) archetype.
 * No-op when they have no archetype yet.
 */
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

/** True when armor, mainHand, or a shield offHand is set. */
export function hasCombatEquipment(
  eq: CharacterEquipment | null | undefined,
): boolean {
  const gear = normalizeEquipment(eq);
  return !!(gear.mainHand || gear.armor || gear.offHand === "shield");
}
