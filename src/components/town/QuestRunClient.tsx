"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameClient } from "@/components/wizardry/GameClient";
import { getRosterEntry } from "@/lib/rosterStorage";
import type { SrdCharacter } from "@/sim/types";
import { PARTY_CAP } from "@/gen/data";

/**
 * Quest entry: export selected roster characters and run the maze.
 * No tavern hire — the Town Square selection is the party.
 */
export function QuestRunClient() {
  const router = useRouter();
  const params = useSearchParams();
  const ids = useMemo(
    () =>
      (params.get("ids") || "")
        .split(",")
        .map((s) => decodeURIComponent(s.trim()))
        .filter(Boolean),
    [params],
  );

  const [party, setParty] = useState<SrdCharacter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (ids.length < 2) {
        setError("Select at least two companions in Town Square to quest.");
        setLoading(false);
        return;
      }
      if (ids.length > PARTY_CAP) {
        setError(`A questing party may have at most ${PARTY_CAP} companions.`);
        setLoading(false);
        return;
      }
      try {
        const exported: SrdCharacter[] = [];
        for (const id of ids) {
          const entry = getRosterEntry(id);
          if (!entry) throw new Error(`Missing companion (${id}).`);
          const res = await fetch("/api/training/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ character: entry.character }),
          });
          const data = await res.json();
          if (!res.ok || !data.character) {
            throw new Error(data.error || `Could not ready ${entry.displayName}`);
          }
          const srd = data.character as SrdCharacter;
          // Unique labels for the maze (export always names PLAYER).
          exported.push({ ...srd, name: entry.displayName });
        }
        if (!cancelled) setParty(exported);
      } catch (err) {
        if (!cancelled) {
          setParty(null);
          setError(err instanceof Error ? err.message : "Quest prep failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (loading) {
    return (
      <div className="stage">
        <div className="app">
          <div className="screen">
            <p className="lede">Gathering the party…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="stage">
        <div className="app">
          <div className="screen">
            <h1>Quest</h1>
            <p className="lede">{error || "Not ready."}</p>
            <div className="origin-actions" style={{ marginTop: 24 }}>
              <button type="button" className="primary" onClick={() => router.push("/")}>
                Town Square
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage stage-quest">
      <div className="app app-quest">
        <div className="quest-adventure">
          <GameClient party={party} onReturnToTown={() => router.push("/")} />
        </div>
      </div>
    </div>
  );
}
