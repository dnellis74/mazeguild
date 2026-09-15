"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJsonOnce } from "@/lib/fetchOnce";
import { companionToPartySnapshot } from "@/sim/adapter";
import { characterLabel } from "@/training/companion";
import { projectFrame } from "@/replay/project";
import type { DungeonResult } from "@/sim/types";
import type { Character } from "@/training/types";
import { DungeonView } from "./DungeonView";
import { EventLog } from "./EventLog";
import { MiniMap } from "./MiniMap";
import { PartyRoster } from "./PartyRoster";

/** Walk pace at 1x. Combat events keep a faster cadence. */
const STEP_MS = 500;
const BATTLE_MS = 160;

/** Maze run UI. Party is chosen in Town Square. */
export function GameClient({
  party,
  onReturnToTown,
}: {
  party: Character[];
  onReturnToTown: (partyAfter?: DungeonResult["partyAfter"]) => void;
}) {
  const [seed, setSeed] = useState(99);
  const [result, setResult] = useState<DungeonResult | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const partyKey = useMemo(
    () => party.map((ch) => characterLabel(ch)).join("|"),
    [party],
  );

  const rosterSnapshot = useMemo(
    () => party.map((ch, i) => companionToPartySnapshot(ch, i)),
    [party],
  );

  const goTown = useCallback(() => {
    onReturnToTown(result?.partyAfter);
  }, [onReturnToTown, result]);

  const enterMaze = useCallback(async () => {
    if (party.length < 2) {
      setError("Need at least two companions to enter the maze.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const { ok, data } = await fetchJsonOnce<
        DungeonResult & { error?: string }
      >("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed, party }),
      });
      if (!ok || data.error) {
        throw new Error(data.error ?? "maze run failed");
      }
      setResult(data);
      setCursor(0);
      setPlaying(true);
      setStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "maze run failed");
    } finally {
      setRunning(false);
    }
  }, [seed, party]);

  // Auto-start once when the party arrives from Town Square.
  useEffect(() => {
    if (started || running || result) return;
    void enterMaze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyKey]);

  const frame = useMemo(
    () => (result ? projectFrame(result, cursor) : null),
    [result, cursor],
  );

  const inMaze = Boolean(result && frame);

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

  return (
    <div className="crt flex h-full min-h-0 max-h-full w-full flex-col overflow-hidden bg-ega-black pb-[max(0.5rem,var(--safe-bottom))] text-ega-light-gray">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ega-dark-gray pb-2 select-none">
        <div className="min-w-0">
          <p className="hidden font-mono text-[10px] tracking-[0.28em] text-ega-cyan lg:block">
            AUTOMATED PARTY CRAWLER — DUNGEON LAYER
          </p>
          <h1 className="truncate font-mono text-lg tracking-widest text-ega-yellow lg:text-2xl">
            MAZE OF THE GUILD
          </h1>
          <button
            type="button"
            onClick={goTown}
            className="mt-1 font-mono text-[10px] tracking-[0.28em] text-ega-bright-cyan underline-offset-2 hover:text-ega-white"
          >
            RETURN TO TOWN SQUARE
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-sm">
          <button
            type="button"
            disabled={!result}
            onClick={download}
            className="tracking-wide text-ega-bright-cyan underline underline-offset-2 hover:text-ega-white disabled:opacity-40 disabled:no-underline"
          >
            JSON
          </button>
          <label className="flex items-center gap-2">
            SEED
            <input
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={seed}
              disabled={started || running}
              onChange={(e) => setSeed(Number(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              className="w-[5.5rem] border border-ega-dark-gray bg-black px-2 text-ega-light-gray disabled:opacity-40"
              aria-label="Dungeon seed"
            />
          </label>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain py-2 phone-land:overflow-hidden lg:overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)_auto] gap-2">
          <div className="col-start-1 row-start-1 flex min-h-0 flex-col gap-2">
            {inMaze && frame && result ? (
              <>
                <DungeonView
                  maze={result.maze}
                  pos={frame.pos}
                  facing={frame.facing}
                  inCombat={frame.inCombat}
                  enemies={frame.enemies}
                />
                <MiniMap maze={result.maze} frame={frame} />
              </>
            ) : (
              <div
                className="flex min-h-0 flex-1 items-center justify-center border border-ega-dark-gray bg-black/80 font-mono text-xs tracking-[0.2em] text-ega-cyan"
                aria-busy={running}
              >
                {running ? "GENERATING MAZE…" : "LOADING…"}
              </div>
            )}
          </div>

          <aside className="col-start-2 row-start-1 min-h-0 overflow-hidden">
            <PartyRoster party={inMaze && frame ? frame.party : rosterSnapshot} />
          </aside>

          <div className="col-span-2 row-start-2 flex min-h-0 flex-col gap-2">
            {error ? (
              <p className="font-mono text-xs text-ega-light-gray">{error}</p>
            ) : null}
            {inMaze && frame?.inCombat ? (
              <p className="font-mono text-xs text-ega-bright-red">
                FIGHTING: {frame.enemies.join(", ")}
              </p>
            ) : null}
            {inMaze && result ? (
              <ReplayDeck
                cursor={cursor}
                length={result.log.length}
                playing={playing}
                speed={speed}
                onPlayPause={() => setPlaying((p) => !p)}
                onStepBack={() => {
                  setPlaying(false);
                  setCursor((c) => Math.max(0, c - 1));
                }}
                onStepForward={() => {
                  setPlaying(false);
                  setCursor((c) => c + 1);
                }}
                onSeek={(n) => {
                  setPlaying(false);
                  setCursor(n);
                }}
                onSpeed={setSpeed}
              />
            ) : null}
            {inMaze && result ? (
              <EventLog log={result.log} cursor={cursor} />
            ) : (
              <TownLog
                lines={
                  error
                    ? [error]
                    : running
                      ? ["The maze is being generated…"]
                      : ["Descending into the maze…"]
                }
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

const SPEEDS = [1, 2, 4] as const;

const vcr =
  "inline-flex min-h-11 min-w-11 items-center justify-center border font-mono text-sm tracking-wide select-none touch-manipulation disabled:opacity-40";

function ReplayDeck({
  cursor,
  length,
  playing,
  speed,
  onPlayPause,
  onStepBack,
  onStepForward,
  onSeek,
  onSpeed,
}: {
  cursor: number;
  length: number;
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek: (n: number) => void;
  onSpeed: (n: number) => void;
}) {
  const last = Math.max(0, length - 1);
  return (
    <div className="border border-ega-dark-gray bg-black/70 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center" role="group" aria-label="Transport">
          <button
            type="button"
            disabled={cursor <= 0}
            onClick={onStepBack}
            className={`${vcr} flex-1 border-ega-dark-gray text-ega-light-gray`}
            aria-label="Step back"
            title="Step back"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            className={`${vcr} flex-[1.6] border-ega-yellow bg-ega-blue text-ega-white`}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            disabled={cursor >= last}
            onClick={onStepForward}
            className={`${vcr} flex-1 border-ega-dark-gray text-ega-light-gray`}
            aria-label="Step forward"
            title="Step"
          >
            ▶
          </button>
        </div>
        <div className="flex shrink-0" role="group" aria-label="Playback speed">
          {SPEEDS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onSpeed(n)}
              aria-pressed={speed === n}
              className={`${vcr} min-w-12 px-2 ${
                speed === n
                  ? "border-ega-yellow bg-ega-blue text-ega-white"
                  : "border-ega-dark-gray text-ega-yellow"
              }`}
            >
              {n}x
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={last}
        value={cursor}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full"
        aria-label="Replay position"
      />
    </div>
  );
}

function TownLog({ lines }: { lines: string[] }) {
  return (
    <ol
      className="h-[22dvh] shrink-0 overflow-y-auto overscroll-contain border border-ega-dark-gray bg-black/60 p-2 font-mono text-xs leading-5 text-ega-light-gray sm:h-48"
      aria-label="Adventure log"
    >
      {lines.map((line) => (
        <li key={line} className="text-ega-cyan">
          {line}
        </li>
      ))}
    </ol>
  );
}
