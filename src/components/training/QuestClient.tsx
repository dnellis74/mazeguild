"use client";

import { useEffect, useMemo, useState } from "react";
import { GameClient } from "@/components/wizardry/GameClient";
import type { Character } from "@/training/types";
import type { SrdCharacter } from "@/sim/types";

/**
 * Quest tab surface: export the training character as PLAYER, then mount the
 * tavern / maze client with them already hired.
 */
export function QuestClient({ character }: { character: Character }) {
  const featureCount = character.features?.length ?? 0;
  const exportKey = useMemo(
    () =>
      JSON.stringify({
        raceId: character.raceId,
        features: character.features,
        scores: character.abilityScores,
        cantrips: character.cantrips,
        spells: character.spells,
      }),
    [character],
  );
  const [recruit, setRecruit] = useState<SrdCharacter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (featureCount < 1) {
      setLoading(false);
      setRecruit(null);
      setError(
        "Earn at least one feature in the World before you enter the tavern.",
      );
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/training/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character }),
        });
        const data = await res.json();
        if (!res.ok || !data.character) {
          throw new Error(
            data.error || "Could not prepare PLAYER for the tavern",
          );
        }
        if (!cancelled) setRecruit(data.character as SrdCharacter);
      } catch (err) {
        if (!cancelled) {
          setRecruit(null);
          setError(err instanceof Error ? err.message : "Export failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // exportKey captures the fields that affect the SRD blob
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportKey, featureCount]);

  if (loading) {
    return (
      <div className="quest-stub">
        <p className="lede">Opening the tavern…</p>
      </div>
    );
  }
  if (error || !recruit) {
    return (
      <div className="quest-stub">
        <h2>Quest</h2>
        <p className="lede" style={{ margin: "0 auto" }}>
          {error || "Not ready."}
        </p>
      </div>
    );
  }

  return (
    <div className="quest-adventure">
      <GameClient key={exportKey} initialRecruit={recruit} />
    </div>
  );
}
