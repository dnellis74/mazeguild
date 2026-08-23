import type { SrdCharacter } from "@/sim/types";

const box =
  "min-h-11 w-full border px-2 py-1.5 text-left font-mono text-xs uppercase tracking-wide select-none touch-manipulation";

export function Tavern({
  patrons,
  selected,
  onToggle,
  busy,
  error,
}: {
  patrons: SrdCharacter[];
  selected: number[];
  onToggle: (index: number) => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-baseline justify-between gap-3 font-mono">
        <h2 className="text-lg tracking-widest text-amber-400">THE TAVERN</h2>
        <p className="text-sm text-amber-500">{selected.length}/6 HIRED</p>
      </div>
      {error ? (
        <p className="font-mono text-sm text-amber-200">{error}</p>
      ) : null}
      {busy && patrons.length === 0 ? (
        <p className="m-auto font-mono text-sm text-amber-600">
          The door opens.
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-2 overflow-y-auto overscroll-y-contain phone-land:grid-cols-3 lg:grid-cols-3">
          {patrons.map((ch, index) => {
            const on = selected.includes(index);
            const full = selected.length >= 6 && !on;
            const hp = ch.hit_points.value;
            const label = ch.name?.trim() || `${ch.race} ${ch.class}`;
            return (
              <button
                key={`${label}-${index}`}
                type="button"
                aria-pressed={on}
                disabled={busy}
                onClick={() => onToggle(index)}
                className={`${box} ${
                  on
                    ? "border-amber-400 bg-amber-900/50 text-amber-100"
                    : full
                      ? "border-amber-900/50 text-amber-700"
                      : "border-amber-800/70 text-amber-200"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 tabular-nums">
                    {hp}/{hp}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-amber-600/80">
                  <span className="truncate">
                    {ch.race} {ch.class}
                  </span>
                  <span className="shrink-0 tabular-nums">XP 0</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
