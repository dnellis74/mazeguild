"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GameClient } from "@/components/wizardry/GameClient";
import { clearQuestParty, readQuestParty } from "@/lib/questHandoff";
import { applyQuestAftermath } from "@/lib/rosterStorage";
import type { Character } from "@/training/types";
import type { DungeonResult } from "@/sim/types";

/**
 * Maze entry: party handed off from Town Square → GameClient.
 * Party is read only after mount so SSR and the first client paint match.
 */
export function QuestPageClient() {
  const router = useRouter();
  const [party, setParty] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const handed = readQuestParty();
    if (handed) {
      setParty(handed);
    } else {
      setError(
        "No party ready. Select companions in Town Square and Quest again.",
      );
    }
    setBooted(true);
  }, []);

  const returnToTown = (partyAfter?: DungeonResult["partyAfter"]) => {
    if (partyAfter?.length) {
      applyQuestAftermath(
        partyAfter.map((p) => ({ id: p.id, xp: p.xp, hp: p.hp })),
      );
    }
    clearQuestParty();
    router.push("/");
  };

  if (!booted || (!party && !error)) {
    return (
      <div className="crt flex min-h-[70dvh] items-center justify-center bg-[#050301] font-mono text-amber-500">
        DESCENDING…
      </div>
    );
  }

  if (error) {
    return (
      <div className="crt flex min-h-[70dvh] flex-col items-start justify-center gap-4 bg-[#050301] p-4 font-mono text-amber-300">
        <h1 className="text-lg tracking-widest text-amber-400">QUEST</h1>
        <p className="text-sm text-amber-200/90">{error}</p>
        <button
          type="button"
          className="border border-amber-400 bg-amber-900/40 px-4 py-3 text-amber-100"
          onClick={() => returnToTown()}
        >
          TOWN SQUARE
        </button>
      </div>
    );
  }

  return (
    <div className="stage stage-quest">
      <div className="app app-quest">
        <div className="quest-adventure">
          <GameClient party={party!} onReturnToTown={returnToTown} />
        </div>
      </div>
    </div>
  );
}
