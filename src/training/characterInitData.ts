import tracks from "@/data/tracks.json";
import races from "@/data/races.json";
import raceQuestions from "@/data/race-questions.json";
import alignments from "@/data/alignments.json";
import alignmentQuestions from "@/data/alignment-questions.json";
import raceAlignment from "@/data/race-alignment.json";

export type CharacterInitData = {
  tracks: typeof tracks;
  races: typeof races;
  raceQuestions: typeof raceQuestions;
  alignments: typeof alignments;
  alignmentQuestions: typeof alignmentQuestions;
  raceAlignment: {
    extras: typeof raceAlignment.extras;
    overrides: typeof raceAlignment.overrides;
    skips: typeof raceAlignment.skips;
    axisBias: typeof raceAlignment.axisBias;
  };
};

/** Server-owned catalog for the `/character` creation wizard. */
export function getCharacterInitData(): CharacterInitData {
  return {
    tracks,
    races,
    raceQuestions,
    alignments,
    alignmentQuestions,
    raceAlignment: {
      extras: raceAlignment.extras,
      overrides: raceAlignment.overrides,
      skips: raceAlignment.skips,
      axisBias: raceAlignment.axisBias,
    },
  };
}
