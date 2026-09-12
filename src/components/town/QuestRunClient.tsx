"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GameClient } from "@/components/wizardry/GameClient";
import { clearQuestParty, readQuestParty } from "@/lib/questHandoff";
import type { Character } from "@/training/types";

/**
 * Maze entry: party is handed off from Town Square.
 * No gate / gathering screen — straight into GameClient.
 */
export function QuestRunClient() {
  const router = useRouter();
  const [party, setParty] = useState<Character[] | null>(() => readQuestParty());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (party) return;
    const handed = readQuestParty();
    if (handed) {
      setParty(handed);
      return;
    }
    setError("No party ready. Select companions in Town Square and Quest again.");
  }, [party]);

  const returnToTown = () => {
    clearQuestParty();
    router.push("/");
  };

  if (error) {
    return (
      <div className="crt flex min-h-[70dvh] flex-col items-start justify-center gap-4 bg-[#050301] p-4 font-mono text-amber-300">
        <h1 className="text-lg tracking-widest text-amber-400">QUEST</h1>
        <p className="text-sm text-amber-200/90">{error}</p>
        <button
          type="button"
          className="border border-amber-400 bg-amber-900/40 px-4 py-3 text-amber-100"
          onClick={returnToTown}
        >
          TOWN SQUARE
        </button>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="crt flex min-h-[70dvh] items-center justify-center bg-[#050301] font-mono text-amber-500">
        DESCENDING…
      </div>
    );
  }

  return (
    <div className="stage stage-quest">
      <div className="app app-quest">
        <div className="quest-adventure">
          <GameClient party={party} onReturnToTown={returnToTown} />
        </div>
      </div>
    </div>
  );
}
