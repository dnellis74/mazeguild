/**
 * Place art in /public/places/{slug}.jpg.
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
  return KNOWN.has(slug) ? `/places/${slug}.jpg` : null;
}
