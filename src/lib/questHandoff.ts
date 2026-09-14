import type { Character } from "@/training/types";
import type { TownReturnLevelUp } from "@/training/townRest";

const QUEST_PARTY_KEY = "mazeguild.questParty";
const LEVEL_UPS_KEY = "mazeguild.townLevelUps";

export type TownLevelUpNotice = TownReturnLevelUp & {
  id: string;
  name: string;
};

export type QuestPartyHandoff = {
  party: Character[];
  createdAt: number;
};

/** In-memory fallback when sessionStorage is unavailable (rare). */
let memoryParty: Character[] | null = null;
let memoryLevelUps: TownLevelUpNotice[] | null = null;

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

/** One-shot notice after a quest that leveled companions. */
export function stashTownLevelUps(levelUps: TownLevelUpNotice[]): void {
  memoryLevelUps = levelUps.length > 0 ? levelUps : null;
  if (typeof window === "undefined") return;
  if (levelUps.length === 0) {
    sessionStorage.removeItem(LEVEL_UPS_KEY);
    return;
  }
  sessionStorage.setItem(LEVEL_UPS_KEY, JSON.stringify(levelUps));
}

/** Consume level-up notices (clears storage). */
export function consumeTownLevelUps(): TownLevelUpNotice[] {
  if (typeof window === "undefined") {
    const mem = memoryLevelUps ?? [];
    memoryLevelUps = null;
    return mem;
  }
  try {
    const raw = sessionStorage.getItem(LEVEL_UPS_KEY);
    sessionStorage.removeItem(LEVEL_UPS_KEY);
    const mem = memoryLevelUps;
    memoryLevelUps = null;
    if (!raw) return mem ?? [];
    const parsed = JSON.parse(raw) as TownLevelUpNotice[];
    return Array.isArray(parsed) ? parsed : mem ?? [];
  } catch {
    const mem = memoryLevelUps ?? [];
    memoryLevelUps = null;
    return mem;
  }
}
