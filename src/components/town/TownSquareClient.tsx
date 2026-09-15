"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceArt } from "@/components/training/PlaceArt";
import {
  getRosterEntry,
  loadRoster,
  upsertRosterEntry,
} from "@/lib/rosterStorage";
import { ensureStarterRoster } from "@/lib/seedRoster";
import {
  consumeTownLevelUps,
  stashQuestParty,
  type TownLevelUpNotice,
} from "@/lib/questHandoff";
import { companionToPartySnapshot } from "@/sim/adapter";
import { PARTY_CAP } from "@/sim/constants";
import { levelForXp, xpForNextLevel } from "@/sim/leveling";
import { ensureCharacterEquipment } from "@/sim/loadout";
import { earnedArchetypes } from "@/training/features";
import {
  AREAS_DISPLAY_NAME,
  TOWN_SQUARE_AREA,
  TOWN_SQUARE_BUILDING,
} from "@/training/townSquare";
import type { Character } from "@/training/types";

export type CatalogLabels = {
  races: Record<string, string>;
  alignments: Record<string, string>;
};

function companionLine(ch: Character, labels: CatalogLabels): string {
  const align =
    labels.alignments[ch.alignment?.alignmentId || ""] ||
    ch.alignment?.alignmentId?.toUpperCase() ||
    "?";
  const race = labels.races[ch.raceId] || ch.raceId || "Unknown";
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
export function TownSquareClient({ labels }: { labels: CatalogLabels }) {
  const router = useRouter();
  const [roster, setRoster] = useState<Character[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [questBusy, setQuestBusy] = useState(false);
  const [questError, setQuestError] = useState<string | null>(null);
  const [levelUpNotes, setLevelUpNotes] = useState<TownLevelUpNotice[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = loadRoster();
      if (current.length === 0) {
        setSeeding(true);
        const seeded = await ensureStarterRoster();
        if (!cancelled) {
          setRoster(seeded);
          setSeeding(false);
          setReady(true);
        }
      } else {
        if (!cancelled) {
          setRoster(current);
          setReady(true);
        }
      }
      if (!cancelled) {
        setLevelUpNotes(consumeTownLevelUps());
      }
    })();
    return () => {
      cancelled = true;
    };
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
  const selectedEntries = useMemo(
    () =>
      selected
        .map((id) => roster.find((c) => c.id === id))
        .filter((c): c is Character => !!c),
    [selected, roster],
  );
  const partyTrained = selectedEntries.every(
    (c) => earnedArchetypes(c).length > 0,
  );
  const canQuest = count >= 2 && partyTrained;

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
        if (!earnedArchetypes(entry)[0]) {
          throw new Error(
            `${entry.name || "A companion"} needs at least one feature before questing.`,
          );
        }
        const geared = ensureCharacterEquipment(entry);
        upsertRosterEntry(geared);
        return geared;
      });
      refresh();
      stashQuestParty(party);
      router.push("/quest");
    } catch (err) {
      setQuestError(err instanceof Error ? err.message : "Could not start quest");
      setQuestBusy(false);
    }
  }, [canQuest, questBusy, selected, router, refresh]);

  const helperNote = useMemo(() => {
    if (roster.length === 0) return null;
    if (count === 0) {
      return "Select a companion to enter the city. Select two or more trained companions to quest.";
    }
    if (count >= 2 && !partyTrained) {
      return "Every quest companion needs at least one earned feature (and gear) first.";
    }
    if (count >= PARTY_CAP) {
      return `Party is full (${PARTY_CAP}). Deselect someone to change the roster.`;
    }
    return null;
  }, [roster.length, count, partyTrained]);

  if (!ready) {
    return (
      <div className="stage">
        <div className="app">
          <div className="screen">
            <p className="lede">
              {seeding
                ? "Travelers gather in the square…"
                : "Loading Town Square…"}
            </p>
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
                    {AREAS_DISPLAY_NAME}
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
                  <span>{AREAS_DISPLAY_NAME}</span>
                  {" / "}
                  <span>{TOWN_SQUARE_AREA}</span>
                  {" / "}
                  <span>{TOWN_SQUARE_BUILDING}</span>
                </>
              )}
            </div>

            <PlaceArt name={TOWN_SQUARE_BUILDING} className="place-art-here" />

            <div className="sheet-block">
              <div className="sheet-label">Actions</div>
              <div className="origin-actions town-square-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    refresh();
                    router.push("/character");
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

              {levelUpNotes.length > 0 ? (
                <div className="sheet-block" style={{ marginBottom: 12 }}>
                  <div className="sheet-label">Level up</div>
                  {levelUpNotes.map((n) => (
                    <p key={n.id} className="mechanic-note" style={{ marginTop: 6 }}>
                      {n.name} reached level {n.toLevel} — gained{" "}
                      {n.levelsGained} Hit Die
                      {n.levelsGained === 1 ? "" : "s"} and {n.featurePointsGranted}{" "}
                      feature points.
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="sheet-block">
                <div className="sheet-label">Companions</div>
              {roster.length === 0 ? (
                <p className="empty-note">
                  {seeding
                    ? "Companions of every calling are arriving…"
                    : "Welcome a stranger to begin. They will return here when their story is set."}
                </p>
              ) : (
                <div className="choice-list town-roster">
                  {roster.map((entry) => {
                    const on = selected.includes(entry.id);
                    const blocked = !on && selected.length >= PARTY_CAP;
                    const identity = companionLine(entry, labels);
                    const archetypes = featureArchetypes(entry);
                    const vitals = companionToPartySnapshot(entry, 0);
                    const level = levelForXp(entry.xp ?? 0);
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
                          <span className="town-roster-name-text">{entry.name}</span>
                        </button>
                        <button
                          type="button"
                          className={`choice-card${on ? " is-selected" : ""}`}
                          disabled={blocked}
                          onClick={() => toggle(entry.id)}
                          aria-pressed={on}
                        >
                          <span className="town-roster-vitals">
                            <span className="town-roster-hp">
                              {vitals.hp}/{vitals.maxHp} HP
                            </span>
                            <span className="town-roster-hp">
                              Level {level}
                            </span>
                            <span className="town-roster-hp">
                              {entry.xp ?? 0}/{xpForNextLevel(entry.xp ?? 0)} XP
                            </span>
                          </span>
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
