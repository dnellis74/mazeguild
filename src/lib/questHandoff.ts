import type { SrdCharacter } from "@/sim/types";

/** Hand off an exported party from Town Square → maze without a gate screen. */
export const QUEST_PARTY_KEY = "mazeguild.questParty";

export type QuestPartyHandoff = {
  party: SrdCharacter[];
  createdAt: number;
};

/** Survives React Strict Mode remounts (sessionStorage take-once does not). */
let memoryParty: SrdCharacter[] | null = null;

export function stashQuestParty(party: SrdCharacter[]): void {
  memoryParty = party;
  if (typeof window === "undefined") return;
  const payload: QuestPartyHandoff = { party, createdAt: Date.now() };
  sessionStorage.setItem(QUEST_PARTY_KEY, JSON.stringify(payload));
}

/** Read the stashed party without clearing (safe under Strict Mode). */
export function readQuestParty(): SrdCharacter[] | null {
  if (memoryParty && memoryParty.length >= 2) return memoryParty;
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(QUEST_PARTY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestPartyHandoff;
    if (!Array.isArray(parsed?.party) || parsed.party.length < 2) return null;
    memoryParty = parsed.party;
    return parsed.party;
  } catch {
    return null;
  }
}

export function clearQuestParty(): void {
  memoryParty = null;
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(QUEST_PARTY_KEY);
}
