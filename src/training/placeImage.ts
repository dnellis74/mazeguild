/**
 * Place art in /public/places/{slug}.jpg (or {slug}-color.png overrides).
 * Slug: lowercase, drop leading "the ", spaces → hyphens.
 */

const KNOWN = new Set([
  "town-gate",
  "town-square",
  "walled-city",
  "keep",
  "wilds",
  "tavern",
]);

/** Prefer flat EGA-color variants when present. */
const COLOR_SRC: Record<string, string> = {
  "town-gate": "/places/town-gate-color.png",
  "town-square": "/places/town-square-color.png",
  "walled-city": "/places/walled-city-color.png",
  keep: "/places/keep-color.png",
  wilds: "/places/wilds-color.png",
  tavern: "/places/tavern-color.png",
};

export function placeSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, "-");
}

/** Public URL for a location’s place image, or null if we have no art. */
export function placeImageSrc(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const slug = placeSlug(name);
  if (!KNOWN.has(slug)) return null;
  return COLOR_SRC[slug] ?? `/places/${slug}.jpg`;
}
