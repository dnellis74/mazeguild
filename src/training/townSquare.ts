/**
 * Town Square — a Walled City building whose activities open UIs,
 * not feature-training jobs. Kept out of skills.json on purpose.
 */

export const TOWN_SQUARE_AREA = "Walled City";
export const TOWN_SQUARE_BUILDING = "Town Square";
export const TOWN_SQUARE_ROOM = "The Square";

export type TownSquarePortal = {
  id: string;
  activity: string;
  description: string;
  /**
   * Client destination. `{id}` is replaced with the current roster character id.
   * Paths ending in `.html` are full page loads; others use the app router.
   */
  href: string;
};

export const TOWN_SQUARE_PORTALS: TownSquarePortal[] = [
  {
    id: "ts_welcome",
    activity: "Welcome a Stranger",
    description: "Invite a new companion through character creation.",
    href: "/character-initialization.html",
  },
  {
    id: "ts_quest",
    activity: "Quest",
    description: "Gather companions in the square and enter the maze.",
    href: "/",
  },
];

export function isTownSquareBuilding(building: string | null | undefined) {
  return building === TOWN_SQUARE_BUILDING;
}

export function isTownSquareLocation(opts: {
  worldArea?: string | null;
  worldBuilding?: string | null;
  worldRoom?: string | null;
}) {
  return (
    opts.worldArea === TOWN_SQUARE_AREA &&
    opts.worldBuilding === TOWN_SQUARE_BUILDING &&
    (opts.worldRoom == null || opts.worldRoom === TOWN_SQUARE_ROOM)
  );
}

export function townSquarePortalById(id: string) {
  return TOWN_SQUARE_PORTALS.find((p) => p.id === id) ?? null;
}

export function resolveTownSquareHref(href: string, characterId: string) {
  return href.replaceAll("{id}", encodeURIComponent(characterId));
}
