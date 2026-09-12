import type { Character } from "@/training/types";

const QUEST_PARTY_KEY = "mazeguild.questParty";

export type QuestPartyHandoff = {
  party: Character[];
  createdAt: number;
};

/** In-memory fallback when sessionStorage is unavailable (rare). */
let memoryParty: Character[] | null = null;

export function stashQuestParty(party: Character[]): void {
  memoryParty = party;
  if (typeof window === "undefined") return;
  const payload: QuestPartyHandoff = { party, createdAt: Date.now() };
  sessionStorage.setItem(QUEST_PARTY_KEY, JSON.stringify(payload));
}

/** Read without clearing — Strict Mode remounts must still see the party. */
export function readQuestParty(): Character[] | null {
  if (typeof window === "undefined") return memoryParty;
  try {
    const raw = sessionStorage.getItem(QUEST_PARTY_KEY);
    if (!raw) return memoryParty;
    const parsed = JSON.parse(raw) as QuestPartyHandoff;
    if (!Array.isArray(parsed.party) || parsed.party.length < 1) {
      return memoryParty;
    }
    memoryParty = parsed.party;
    return parsed.party;
  } catch {
    return memoryParty;
  }
}

export function clearQuestParty(): void {
  memoryParty = null;
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(QUEST_PARTY_KEY);
}
