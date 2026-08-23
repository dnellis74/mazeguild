"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { projectFrame } from "@/replay/project";
import { runDungeon } from "@/sim/run";
import type { DungeonResult, SrdCharacter } from "@/sim/types";
import { DungeonView } from "./DungeonView";
import { EventLog } from "./EventLog";
import { MiniMap } from "./MiniMap";
import { PartyRoster } from "./PartyRoster";
import { Tavern } from "./Tavern";

const tap =
  "inline-flex min-h-11 min-w-11 items-center justify-center border px-3 font-mono text-sm tracking-wide select-none touch-manipulation disabled:opacity-40";

/** Walk pace at 1x. Combat events keep a faster cadence. */
const STEP_MS = 500;
const BATTLE_MS = 160;
const PARTY_SIZE = 6;
const TAVERN_SIZE = 12;

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

  const run = useCallback(() => {
    if (selected.length !== PARTY_SIZE) {
      setError("Hire 6 from the tavern.");
      return;
    }
    const party = selected
      .map((i) => patrons[i])
      .filter((ch): ch is SrdCharacter => ch !== undefined);
    if (party.length !== PARTY_SIZE) {
      setError("Hire 6 from the tavern.");
      return;
    }
    setError(null);
    const next = runDungeon({ seed, party });
    setResult(next);
    setCursor(0);
    setPlaying(true);
  }, [seed, selected, patrons]);

  function backToTavern() {
    setResult(null);
    setPlaying(false);
  }

  const frame = useMemo(
    () => (result ? projectFrame(result, cursor) : null),
    [result, cursor],
  );

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
          {result ? (
            <button
              type="button"
              onClick={backToTavern}
              className="mt-1 font-mono text-[10px] tracking-[0.28em] text-amber-500 underline-offset-2 hover:text-amber-300"
            >
              THE TAVERN
            </button>
          ) : null}
        </div>
        <label className="flex shrink-0 items-center gap-2 font-mono text-sm">
          SEED
          <input
            type="number"
            inputMode="numeric"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy && selected.length === PARTY_SIZE) {
                run();
              }
            }}
            className="w-[5.5rem] border border-amber-700 bg-black px-2 text-amber-200"
            aria-label="Dungeon seed"
          />
        </label>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain py-2 phone-land:overflow-hidden lg:overflow-hidden">
        {!result || !frame ? (
          <Tavern
            patrons={patrons}
            selected={selected}
            onToggle={toggleHire}
            busy={busy}
            error={error}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 phone-land:grid phone-land:h-full phone-land:grid-cols-[minmax(0,1.35fr)_minmax(10.5rem,0.9fr)] phone-land:grid-rows-[auto_minmax(0,1fr)] phone-land:gap-2 lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_12.5rem] lg:grid-rows-[auto_auto_auto_1fr]">
            <div className="phone-land:col-start-1 phone-land:row-span-2 phone-land:row-start-1 phone-land:min-h-0 lg:col-start-1 lg:row-start-1">
              <DungeonView
                maze={result.maze}
                pos={frame.pos}
                facing={frame.facing}
                inCombat={frame.inCombat}
                enemies={frame.enemies}
              />
            </div>

            <aside className="flex flex-row items-start gap-3 phone-land:col-start-2 phone-land:row-start-1 lg:col-start-2 lg:row-start-1 lg:flex-col">
              <MiniMap maze={result.maze} frame={frame} />
              <div className="font-mono text-xs leading-5 text-amber-500">
                <div>
                  POS {frame.pos.x},{frame.pos.y} FACE{" "}
                  {frame.facing.toUpperCase()}
                </div>
                <div>XP {frame.score}</div>
                <div>STEPS {cursor}</div>
                {frame.outcome !== "ongoing" && (
                  <div className="text-amber-200">{frame.outcome}</div>
                )}
              </div>
            </aside>

            <div className="flex min-h-0 flex-col gap-2 phone-land:col-start-2 phone-land:row-start-2 phone-land:overflow-y-auto lg:col-span-2">
              <PartyRoster party={frame.party} />
              {frame.inCombat && (
                <p className="font-mono text-xs text-red-400">
                  FIGHTING: {frame.enemies.join(", ")}
                </p>
              )}
              <p className="min-h-10 font-mono text-sm leading-5 text-amber-200">
                {frame.lastNarrative}
              </p>
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
              <EventLog log={result.log} cursor={cursor} />
            </div>
          </div>
        )}
      </main>

      <nav className="relative z-20 grid shrink-0 grid-cols-4 gap-2 border-t border-amber-900/70 bg-[#050301] pt-2 pb-[max(0.5rem,var(--safe-bottom))] phone-land:flex sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={run}
          disabled={busy || selected.length !== PARTY_SIZE}
          className={`${tap} col-span-2 border-amber-400 bg-amber-900/40 text-amber-100 phone-land:flex-1 sm:flex-1`}
        >
          RUN
        </button>
        <button
          type="button"
          disabled={!result}
          onClick={() => setPlaying((p) => !p)}
          className={`${tap} border-amber-700 phone-land:flex-1 sm:flex-1`}
        >
          {playing ? "PAUSE" : "PLAY"}
        </button>
        <button
          type="button"
          disabled={atEnd}
          onClick={() => setCursor((c) => c + 1)}
          className={`${tap} border-amber-700 phone-land:flex-1 sm:flex-1`}
        >
          STEP
        </button>
        <label className={`${tap} col-span-2 gap-2 border-amber-700 phone-land:flex-1 sm:flex-1`}>
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
