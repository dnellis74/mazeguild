"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getRosterEntry,
  loadRoster,
} from "@/lib/rosterStorage";
import { stashQuestParty } from "@/lib/questHandoff";
import { PARTY_CAP } from "@/sim/constants";
import {
  TOWN_SQUARE_AREA,
  TOWN_SQUARE_BUILDING,
} from "@/training/townSquare";
import type { Character } from "@/training/types";

type CatalogLabels = {
  races: Record<string, string>;
  alignments: Record<string, string>;
};

function companionLine(ch: Character, labels: CatalogLabels | null): string {
  const align =
    labels?.alignments[ch.alignment?.alignmentId || ""] ||
    ch.alignment?.alignmentId?.toUpperCase() ||
    "?";
  const race = labels?.races[ch.raceId] || ch.raceId || "Unknown";
  return `${align} ${race}`;
}

function featureArchetypes(ch: Character): string {
  const archetypes = (ch.features || [])
    .slice(0, 2)
    .map((f) => f.archetype)
    .filter(Boolean);
  return archetypes.join(" · ");
}

/**
 * Town Square — adventure home.
 * 0 selected: Welcome a Stranger
 * 1 selected: Enter the City (+ crumb into the world)
 * 2+ selected: Quest (party → maze)
 */
export function TownSquareClient() {
  const router = useRouter();
  const [roster, setRoster] = useState<Character[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [labels, setLabels] = useState<CatalogLabels | null>(null);
  const [questBusy, setQuestBusy] = useState(false);
  const [questError, setQuestError] = useState<string | null>(null);

  useEffect(() => {
    setRoster(loadRoster());
    setReady(true);
    void fetch("/api/training/catalog")
      .then((r) => r.json())
      .then((data) => {
        const races: Record<string, string> = {};
        const alignments: Record<string, string> = {};
        for (const r of data.races || []) races[r.id] = r.name;
        for (const a of data.alignments || []) alignments[a.id] = a.name;
        setLabels({ races, alignments });
      })
      .catch(() => {
        /* fall back to raw ids on the cards */
      });
  }, []);

  const refresh = useCallback(() => {
    setRoster(loadRoster());
  }, []);

  const toggle = (id: string) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= PARTY_CAP) return cur;
      return [...cur, id];
    });
  };

  const count = selected.length;
  const exploreId = count === 1 ? selected[0]! : null;
  const canEnterCity = count === 1;
  const canQuest = count >= 2;

  const explore = useCallback(
    (opts?: { area?: string }) => {
      if (!exploreId) return;
      const q = new URLSearchParams({ id: exploreId });
      if (opts?.area) q.set("area", opts.area);
      router.push(`/training?${q.toString()}`);
    },
    [exploreId, router],
  );

  const startQuest = useCallback(() => {
    if (!canQuest || questBusy) return;
    setQuestBusy(true);
    setQuestError(null);
    try {
      const party = selected.map((id) => {
        const entry = getRosterEntry(id);
        if (!entry) throw new Error(`Missing companion (${id}).`);
        return entry;
      });
      stashQuestParty(party);
      router.push("/quest");
    } catch (err) {
      setQuestError(err instanceof Error ? err.message : "Could not start quest");
      setQuestBusy(false);
    }
  }, [canQuest, questBusy, selected, router]);

  const helperNote = useMemo(() => {
    if (roster.length === 0) return null;
    if (count === 0) {
      return "Select a companion to enter the city. Select two or more to quest.";
    }
    if (count >= PARTY_CAP) {
      return `Party is full (${PARTY_CAP}). Deselect someone to change the roster.`;
    }
    return null;
  }, [roster.length, count]);

  if (!ready) {
    return (
      <div className="stage">
        <div className="app">
          <div className="screen">
            <p className="lede">Loading Town Square…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="app">
        <div className="hub">
          <div className="hub-header">
            <p className="kicker">{TOWN_SQUARE_AREA}</p>
            <h1>{TOWN_SQUARE_BUILDING}</h1>
            <p className="hub-meta">
              {roster.length === 0
                ? "No one stands in the square yet."
                : `${roster.length} companion${roster.length === 1 ? "" : "s"} · ${count} selected`}
            </p>
          </div>

          <div className="hub-body town-square-body">
            <div className="world-crumb" aria-label="Location">
              {canEnterCity ? (
                <>
                  <button type="button" onClick={() => explore()}>
                    Areas
                  </button>
                  {" / "}
                  <button type="button" onClick={() => explore({ area: TOWN_SQUARE_AREA })}>
                    {TOWN_SQUARE_AREA}
                  </button>
                  {" / "}
                  <span>{TOWN_SQUARE_BUILDING}</span>
                </>
              ) : (
                <>
                  <span>Areas</span>
                  {" / "}
                  <span>{TOWN_SQUARE_AREA}</span>
                  {" / "}
                  <span>{TOWN_SQUARE_BUILDING}</span>
                </>
              )}
            </div>

            <div className="sheet-block">
              <div className="sheet-label">Actions</div>
              <div className="origin-actions town-square-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    refresh();
                    window.location.href = "/character-initialization.html";
                  }}
                >
                  Welcome a Stranger
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!canEnterCity}
                  onClick={() => explore({ area: TOWN_SQUARE_AREA })}
                >
                  Enter the City
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!canQuest || questBusy}
                  onClick={() => void startQuest()}
                >
                  {questBusy ? "Entering maze…" : "Quest"}
                </button>
              </div>
              {questError ? (
                <p className="mechanic-note" style={{ marginTop: 12 }}>
                  {questError}
                </p>
              ) : null}
              {helperNote ? (
                <p className="mechanic-note" style={{ marginTop: 12 }}>
                  {helperNote}
                </p>
              ) : null}
            </div>

            <div className="sheet-block">
              <div className="sheet-label">Companions</div>
              {roster.length === 0 ? (
                <p className="empty-note">
                  Welcome a stranger to begin. They will return here when their story is set.
                </p>
              ) : (
                <div className="choice-list town-roster">
                  {roster.map((entry) => {
                    const on = selected.includes(entry.id);
                    const blocked = !on && selected.length >= PARTY_CAP;
                    const identity = companionLine(entry, labels);
                    const archetypes = featureArchetypes(entry);
                    return (
                      <div key={entry.id} className="town-roster-item">
                        <button
                          type="button"
                          className="town-roster-name"
                          onClick={() =>
                            router.push(
                              `/training?id=${encodeURIComponent(entry.id)}&tab=sheet`,
                            )
                          }
                        >
                          {entry.name}
                        </button>
                        <button
                          type="button"
                          className={`choice-card${on ? " is-selected" : ""}`}
                          disabled={blocked}
                          onClick={() => toggle(entry.id)}
                          aria-pressed={on}
                        >
                          <span className="choice-sub">{identity}</span>
                          {archetypes ? (
                            <span className="choice-sub">{archetypes}</span>
                          ) : (
                            <span className="choice-sub">No features yet</span>
                          )}
                          <span className="choice-sub">
                            {on ? "Selected" : blocked ? "Party full" : "Tap to select"}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
