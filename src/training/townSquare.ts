/**
 * Town Square — a Walled City building that returns to the roster hub.
 * Welcome / Quest live on `/` (TownSquareClient), not as in-world portals.
 */

/** UI label for the top-level areas list (`worldView: "areas"`). */
export const AREAS_DISPLAY_NAME = "Town Gate";
export const TOWN_SQUARE_AREA = "Walled City";
export const TOWN_SQUARE_BUILDING = "Town Square";

export function isTownSquareBuilding(building: string | null | undefined) {
  return building === TOWN_SQUARE_BUILDING;
}
