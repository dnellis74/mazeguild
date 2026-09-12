import type { Catalog } from "./catalog";
import { asFeatureList } from "./features";
import type { Character, Skill } from "./types";
import {
  TOWN_SQUARE_AREA,
  TOWN_SQUARE_BUILDING,
  TOWN_SQUARE_ROOM,
} from "./townSquare";

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

  return injectTownSquare(
    Object.values(areas).map((a) => ({
      name: a.name,
      buildings: Object.values(a.buildings).map((b) => ({
        name: b.name,
        rooms: Object.values(b.rooms).map((r) => ({
          name: r.name,
          activities: r.activities,
        })),
      })),
    })),
  );
}

/** Town Square is a portal building, not derived from skills.json. */
export function injectTownSquare(areas: WorldArea[]): WorldArea[] {
  const square: WorldBuilding = {
    name: TOWN_SQUARE_BUILDING,
    rooms: [{ name: TOWN_SQUARE_ROOM, activities: [] }],
  };

  const result = areas.map((a) => {
    if (a.name !== TOWN_SQUARE_AREA) return a;
    if (a.buildings.some((b) => b.name === TOWN_SQUARE_BUILDING)) return a;
    return { ...a, buildings: [square, ...a.buildings] };
  });

  if (!result.some((a) => a.name === TOWN_SQUARE_AREA)) {
    result.unshift({ name: TOWN_SQUARE_AREA, buildings: [square] });
  }
  return result;
}

/** Always available — starting place and adventure hub. */
export function grantTownSquareAccess(ch: Character): Character {
  const unlocked = ch.unlocked || { areas: {}, buildings: {}, rooms: {} };
  return {
    ...ch,
    unlocked: {
      areas: { ...unlocked.areas, [areaKey(TOWN_SQUARE_AREA)]: true },
      buildings: {
        ...unlocked.buildings,
        [buildingKey(TOWN_SQUARE_AREA, TOWN_SQUARE_BUILDING)]: true,
      },
      rooms: {
        ...unlocked.rooms,
        [roomKey(TOWN_SQUARE_AREA, TOWN_SQUARE_BUILDING, TOWN_SQUARE_ROOM)]: true,
      },
    },
  };
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
  return grantTownSquareAccess({
    ...ch,
    unlocked: ch.unlocked || { areas: {}, buildings: {}, rooms: {} },
  });
}
