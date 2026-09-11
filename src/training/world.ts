import type { Catalog } from "./catalog";
import { asFeatureList } from "./features";
import type { Character, Skill } from "./types";

export type WorldActivity = {
  id: string;
  activity: string;
  feature: string[];
  archetype: string;
  detail?: string;
  description?: string;
  prerequisite: string | null;
  fills?: number;
  fillMsSec?: number;
};

export type WorldRoom = { name: string; activities: WorldActivity[] };
export type WorldBuilding = { name: string; rooms: WorldRoom[] };
export type WorldArea = { name: string; buildings: WorldBuilding[] };

export function buildWorld(catalog: Catalog): WorldArea[] {
  const areas: Record<
    string,
    {
      name: string;
      buildings: Record<
        string,
        { name: string; rooms: Record<string, { name: string; activities: WorldActivity[] }> }
      >;
    }
  > = {};

  for (const f of catalog.skills) {
    if (!f.id) continue;
    if (!areas[f.area]) areas[f.area] = { name: f.area, buildings: {} };
    const a = areas[f.area]!;
    if (!a.buildings[f.building]) a.buildings[f.building] = { name: f.building, rooms: {} };
    const b = a.buildings[f.building]!;
    if (!b.rooms[f.room]) b.rooms[f.room] = { name: f.room, activities: [] };
    const r = b.rooms[f.room]!;
    if (!r.activities.some((x) => x.id === f.id)) {
      r.activities.push({
        id: f.id,
        activity: f.activity,
        feature: asFeatureList(f.feature),
        archetype: f.archetype,
        detail: f.detail,
        description: f.description,
        prerequisite: f.prerequisite ?? null,
        fills: f.fills,
        fillMsSec: f.fillMsSec,
      });
    }
  }

  return Object.values(areas).map((a) => ({
    name: a.name,
    buildings: Object.values(a.buildings).map((b) => ({
      name: b.name,
      rooms: Object.values(b.rooms).map((r) => ({
        name: r.name,
        activities: r.activities,
      })),
    })),
  }));
}

export function areaKey(area: string) {
  return area;
}
export function buildingKey(area: string, building: string) {
  return `${area}::${building}`;
}
export function roomKey(area: string, building: string, room: string) {
  return `${area}::${building}::${room}`;
}

export function timingSpec(fills: number, fillMsSec: number) {
  return {
    fills,
    fillMsSec,
    durationMs: fills * fillMsSec * 1000,
  };
}

export function unlockTiming(catalog: Catalog) {
  const u = catalog.timing.unlock || { fills: 6, fillMsSec: 0.5 };
  return timingSpec(u.fills ?? 6, u.fillMsSec ?? 0.5);
}

export function featureTiming(catalog: Catalog, skill?: Partial<Skill> | null) {
  const d = catalog.timing.featureDefault || { fills: 6, fillMsSec: 1 };
  return timingSpec(skill?.fills ?? d.fills ?? 6, skill?.fillMsSec ?? d.fillMsSec ?? 1);
}

export function ensureUnlocked(ch: Character): Character {
  return {
    ...ch,
    unlocked: ch.unlocked || { areas: {}, buildings: {}, rooms: {} },
  };
}
