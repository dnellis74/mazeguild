"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadRoster,
  type RosterEntry,
} from "@/lib/rosterStorage";
import { PARTY_CAP } from "@/gen/data";
import {
  TOWN_SQUARE_AREA,
  TOWN_SQUARE_BUILDING,
} from "@/training/townSquare";

/**
 * Town Square — adventure home.
 * 0 selected: Welcome a Stranger
 * 1 selected: crumb into the world (Areas / Walled City)
 * 2+ selected: Quest (party → maze)
 */
export function TownSquareClient() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRoster(loadRoster());
    setReady(true);
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

  const explore = useCallback(
    (opts?: { area?: string }) => {
      if (!exploreId) return;
      const q = new URLSearchParams({ id: exploreId });
      if (opts?.area) q.set("area", opts.area);
      router.push(`/training?${q.toString()}`);
    },
    [exploreId, router],
  );

  const questAction = useMemo(() => {
    if (count < 2) return null;
    return {
      id: "quest",
      label: "Quest",
      onClick: () =>
        router.push(`/quest?ids=${selected.map(encodeURIComponent).join(",")}`),
    };
  }, [count, selected, router]);

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
              {exploreId ? (
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
                {questAction ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={questAction.onClick}
                  >
                    {questAction.label}
                  </button>
                ) : null}
              </div>
              {count === 0 && roster.length > 0 ? (
                <p className="mechanic-note" style={{ marginTop: 12 }}>
                  Select a companion, then use the crumb to explore. Select two or more to
                  quest.
                </p>
              ) : null}
              {count >= PARTY_CAP ? (
                <p className="mechanic-note" style={{ marginTop: 12 }}>
                  Party is full ({PARTY_CAP}). Deselect someone to change the roster.
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
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`choice-card${on ? " is-selected" : ""}`}
                        disabled={blocked}
                        onClick={() => toggle(entry.id)}
                        aria-pressed={on}
                      >
                        <span className="choice-title">{entry.displayName}</span>
                        <span className="choice-sub">
                          {on ? "Selected" : blocked ? "Party full" : "Tap to select"}
                          {" · "}
                          {entry.character.features?.length ?? 0} feature
                          {(entry.character.features?.length ?? 0) === 1 ? "" : "s"}
                        </span>
                      </button>
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
