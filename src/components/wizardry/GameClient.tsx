"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { projectFrame } from "@/replay/project";
import { runDungeon } from "@/sim/run";
import type { DungeonResult, SrdCharacter } from "@/sim/types";
import { DungeonView } from "./DungeonView";
import { EventLog } from "./EventLog";
import { MiniMap } from "./MiniMap";
import { PartyRoster } from "./PartyRoster";

const tap =
  "inline-flex min-h-11 min-w-11 items-center justify-center border px-3 font-mono text-sm tracking-wide select-none touch-manipulation disabled:opacity-40";

/** Walk pace at 1x. Combat events keep a faster cadence. */
const STEP_MS = 500;
const BATTLE_MS = 160;
const PARTY_SIZE = 6;
const TAVERN_SIZE = 12;

const TOWN_LINES = [
  "A busy town. Adventurers linger by the tavern door.",
  "Hire six companions, then press ENTER MAZE.",
];

export function GameClient() {
  const [seed, setSeed] = useState(99);
  const [patrons, setPatrons] = useState<SrdCharacter[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<DungeonResult | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const id = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      setResult(null);
      setPlaying(false);
      setSelected([]);
      void (async () => {
        try {
          const res = await fetch("/api/party", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              seed,
              count: TAVERN_SIZE,
              balanced: false,
              names: true,
            }),
            signal: ac.signal,
          });
          const data = (await res.json()) as {
            error?: string;
            party?: SrdCharacter[];
          };
          if (!res.ok || !data.party) {
            throw new Error(data.error ?? "tavern failed to fill");
          }
          setPatrons(data.party);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setPatrons([]);
          setError(err instanceof Error ? err.message : "tavern failed to fill");
        } finally {
          if (!ac.signal.aborted) setBusy(false);
        }
      })();
    }, 280);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, [seed]);

  const toggleHire = useCallback((index: number) => {
    setSelected((cur) => {
      if (cur.includes(index)) return cur.filter((i) => i !== index);
      if (cur.length >= PARTY_SIZE) return cur;
      return [...cur, index];
    });
  }, []);

  const enterTavern = useCallback(() => {
    if (selected.length !== PARTY_SIZE) {
      setError("Hire 6 companions first.");
      return;
    }
    const party = selected
      .map((i) => patrons[i])
      .filter((ch): ch is SrdCharacter => ch !== undefined);
    if (party.length !== PARTY_SIZE) {
      setError("Hire 6 companions first.");
      return;
    }
    setError(null);
    const next = runDungeon({ seed, party });
    setResult(next);
    setCursor(0);
    setPlaying(false);
  }, [seed, selected, patrons]);

  function backToTown() {
    setResult(null);
    setPlaying(false);
  }

  const frame = useMemo(
    () => (result ? projectFrame(result, cursor) : null),
    [result, cursor],
  );

  const inMaze = Boolean(result && frame);

  useEffect(() => {
    if (!result || !frame) return;
    console.log("[maze]", {
      pos: `${frame.pos.x},${frame.pos.y}`,
      face: frame.facing.toUpperCase(),
      xp: frame.score,
      steps: cursor,
    });
  }, [result, frame, cursor]);

  useEffect(() => {
    if (!playing || !result) return;
    const event = result.log[cursor];
    const base = event?.event === "step" ? STEP_MS : BATTLE_MS;
    const id = window.setTimeout(() => {
      if (cursor >= result.log.length - 1) {
        setPlaying(false);
        return;
      }
      setCursor((c) => c + 1);
    }, base / speed);
    return () => window.clearTimeout(id);
  }, [playing, result, cursor, speed]);

  function download() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dungeon-${result.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const atEnd = !result || cursor >= result.log.length - 1;

  return (
    <div className="crt flex h-dvh max-h-dvh flex-col overflow-hidden px-[max(1rem,var(--safe-left))] pt-[max(0.5rem,var(--safe-top))] pr-[max(1rem,var(--safe-right))] text-amber-300">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-800/70 pb-2 select-none">
        <div className="min-w-0">
          <p className="hidden font-mono text-[10px] tracking-[0.28em] text-amber-600 lg:block">
            AUTOMATED PARTY CRAWLER — DUNGEON LAYER
          </p>
          <h1 className="truncate font-mono text-lg tracking-widest text-amber-400 lg:text-2xl">
            MAZE OF THE GUILD
          </h1>
          {inMaze ? (
            <button
              type="button"
              onClick={backToTown}
              className="mt-1 font-mono text-[10px] tracking-[0.28em] text-amber-500 underline-offset-2 hover:text-amber-300"
            >
              THE MAZE
            </button>
          ) : (
            <p className="mt-1 font-mono text-[10px] tracking-[0.28em] text-amber-500">
              A BUSY TOWN
            </p>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 font-mono text-sm">
          SEED
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            onFocus={(e) => e.currentTarget.select()}
            className="w-[5.5rem] border border-amber-700 bg-black px-2 text-amber-200"
            aria-label="Dungeon seed"
          />
        </label>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain py-2 phone-land:overflow-hidden lg:overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_auto] gap-2">
          <div className="col-start-1 row-start-1 flex min-h-0 flex-col gap-2">
            {inMaze && frame && result ? (
              <>
                <DungeonView
                  scene="maze"
                  maze={result.maze}
                  pos={frame.pos}
                  facing={frame.facing}
                  inCombat={frame.inCombat}
                  enemies={frame.enemies}
                />
                <MiniMap maze={result.maze} frame={frame} />
              </>
            ) : (
              <>
                <DungeonView scene="town" />
                <TownMap />
              </>
            )}
          </div>

          <aside className="col-start-2 row-start-1 min-h-0 overflow-hidden">
            {inMaze && frame ? (
              <PartyRoster party={frame.party} />
            ) : (
              <PartyRoster
                mode="hire"
                patrons={patrons}
                selected={selected}
                onToggle={toggleHire}
                busy={busy}
              />
            )}
          </aside>

          <div className="col-span-2 row-start-2 flex min-h-0 flex-col gap-2">
            {error ? (
              <p className="font-mono text-xs text-amber-200">{error}</p>
            ) : null}
            {inMaze && frame?.inCombat ? (
              <p className="font-mono text-xs text-red-400">
                FIGHTING: {frame.enemies.join(", ")}
              </p>
            ) : null}
            {inMaze && result ? (
              <input
                type="range"
                min={0}
                max={Math.max(0, result.log.length - 1)}
                value={cursor}
                onChange={(e) => {
                  setPlaying(false);
                  setCursor(Number(e.target.value));
                }}
                className="w-full"
                aria-label="Replay position"
              />
            ) : null}
            {inMaze && result ? (
              cursor === 0 && !playing ? (
                <TownLog lines={["Press PLAY to see the party's fate."]} />
              ) : (
                <EventLog log={result.log} cursor={cursor} />
              )
            ) : (
              <TownLog lines={TOWN_LINES} />
            )}
          </div>
        </div>
      </main>

      <nav className="relative z-20 grid shrink-0 grid-cols-4 gap-2 border-t border-amber-900/70 bg-[#050301] pt-2 pb-[max(0.5rem,var(--safe-bottom))] phone-land:flex sm:flex sm:flex-wrap">
        {inMaze ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className={`${tap} col-span-2 border-amber-400 bg-amber-900/40 text-amber-100 phone-land:flex-1 sm:flex-1`}
          >
            {playing ? "PAUSE" : "PLAY"}
          </button>
        ) : (
          <button
            type="button"
            onClick={enterTavern}
            disabled={busy || selected.length !== PARTY_SIZE}
            className={`${tap} col-span-2 border-amber-400 bg-amber-900/40 text-amber-100 phone-land:flex-1 sm:flex-1`}
          >
            ENTER MAZE
          </button>
        )}
        <button
          type="button"
          disabled={atEnd}
          onClick={() => {
            setPlaying(false);
            setCursor((c) => c + 1);
          }}
          className={`${tap} border-amber-700 phone-land:flex-1 sm:flex-1`}
        >
          STEP
        </button>
        <label
          className={`${tap} col-span-2 gap-2 border-amber-700 phone-land:flex-1 sm:flex-1`}
        >
          SPD
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="min-h-0 border-0 bg-transparent py-0"
            aria-label="Playback speed"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!result}
          onClick={download}
          className={`${tap} col-span-2 border-amber-700 phone-land:flex-1 sm:flex-1`}
        >
          JSON
        </button>
      </nav>
    </div>
  );
}

function TownMap() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="aspect-square w-full max-w-[7.5rem] shrink-0 self-start border border-amber-700/60 bg-black sm:max-w-[10rem] lg:max-w-[12.5rem]"
      aria-label="Town street map"
    >
      <rect x="16" y="16" width="16" height="16" fill="#3a2a10" />
      <rect x="18" y="18" width="12" height="12" fill="#e4b45a" />
      <line x1="16" y1="16" x2="32" y2="16" stroke="#c48a30" strokeWidth="1" />
      <line x1="32" y1="16" x2="32" y2="32" stroke="#c48a30" strokeWidth="1" />
      <line x1="16" y1="32" x2="32" y2="32" stroke="#c48a30" strokeWidth="1" />
      <line x1="16" y1="16" x2="16" y2="32" stroke="#c48a30" strokeWidth="1" />
    </svg>
  );
}

function TownLog({ lines }: { lines: string[] }) {
  return (
    <ol
      className="h-[22dvh] shrink-0 overflow-y-auto overscroll-contain border border-amber-800/60 bg-black/60 p-2 font-mono text-xs leading-5 text-amber-300 sm:h-48"
      aria-label="Adventure log"
    >
      {lines.map((line) => (
        <li key={line} className="text-amber-400/80">
          {line}
        </li>
      ))}
    </ol>
  );
}
