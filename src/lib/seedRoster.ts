import { fetchJsonOnce } from "@/lib/fetchOnce";
import { loadRoster, upsertRosterEntry } from "@/lib/rosterStorage";
import { CLASS_ARCHETYPES } from "@/training/archetypeFeatures";
import type { Character } from "@/training/types";

/** Cycle races / alignments so the seeded square isn’t twelve identical humans. */
const SEED_RACES = [
  "human",
  "elf",
  "dwarf",
  "halfling",
  "halforc",
  "gnome",
  "halfelf",
  "dragonborn",
  "tiefling",
] as const;

const SEED_ALIGNMENTS = [
  "lg",
  "ng",
  "cg",
  "ln",
  "n",
  "cn",
  "le",
  "ne",
  "ce",
] as const;

let seedInflight: Promise<Character[]> | null = null;

/**
 * When the Town Square roster is empty, create one companion per class
 * archetype via POST /api/characters and persist them.
 */
export async function ensureStarterRoster(): Promise<Character[]> {
  const existing = loadRoster();
  if (existing.length > 0) return existing;
  if (seedInflight) return seedInflight;

  seedInflight = (async () => {
    // Re-check after awaiting (Strict Mode / concurrent callers).
    const again = loadRoster();
    if (again.length > 0) return again;

    const taken: string[] = [];
    for (let i = 0; i < CLASS_ARCHETYPES.length; i++) {
      const archetype = CLASS_ARCHETYPES[i]!;
      const raceId = SEED_RACES[i % SEED_RACES.length]!;
      const alignmentId = SEED_ALIGNMENTS[i % SEED_ALIGNMENTS.length]!;
      const { ok, data } = await fetchJsonOnce<{
        character?: Character;
        error?: string;
      }>("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceId,
          alignmentId,
          archetype,
          taken,
        }),
      });
      if (!ok || !data.character) {
        console.error(
          JSON.stringify({
            msg: "starter_roster_seed_failed",
            archetype,
            error: data.error ?? "unknown",
          }),
        );
        continue;
      }
      upsertRosterEntry(data.character);
      taken.push(data.character.name);
    }
    return loadRoster();
  })();

  try {
    return await seedInflight;
  } finally {
    seedInflight = null;
  }
}
