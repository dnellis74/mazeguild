import type { PartySnapshot } from "@/sim/types";
import type { SrdCharacter } from "@/sim/types";
import { characterLabel } from "@/campaign/tavern";
import { PARTY_CAP } from "@/gen/data";

type HireProps = {
  mode: "hire";
  patrons: SrdCharacter[];
  selected: string[];
  disabled?: string[];
  onInspect: (label: string) => void;
  busy?: boolean;
};

type PartyProps = {
  mode?: "party";
  party: PartySnapshot[];
};

export function PartyRoster(props: HireProps | PartyProps) {
  if (props.mode === "hire") {
    const { patrons, selected, disabled = [], onInspect, busy } = props;
    const disabledSet = new Set(disabled);
    return (
      <div className="flex h-full min-h-0 flex-col gap-1 font-mono text-[10px] uppercase leading-tight tracking-wide sm:gap-1.5 sm:text-xs sm:leading-normal">
        <p className="shrink-0 text-amber-500">
          {selected.length}/{PARTY_CAP} HIRED
        </p>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain sm:gap-1.5">
          {patrons.map((ch) => {
            const label = characterLabel(ch);
            const on = selected.includes(label);
            const dead = disabledSet.has(label);
            const full = selected.length >= PARTY_CAP && !on;
            const hp = ch.hit_points.value;
            const level = ch.meta?.level ?? 1;
            const xp = ch.xp ?? 0;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                disabled={busy || dead}
                onClick={() => onInspect(label)}
                className={`shrink-0 border px-1.5 py-1 text-left select-none touch-manipulation disabled:opacity-40 sm:px-2 sm:py-1.5 ${
                  dead
                    ? "border-red-900/70 text-red-600"
                    : on
                      ? "border-amber-400 bg-amber-900/50 text-amber-100"
                      : full
                        ? "border-amber-900/40 text-amber-700"
                        : "border-amber-800/70 text-amber-200"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate">{label}</span>
                  <span className="shrink-0 tabular-nums">
                    {dead ? "FALLEN" : `${hp}/${hp}`}
                  </span>
                </div>
                <div className="flex justify-between gap-2 text-amber-600/80">
                  <span className="truncate">
                    {ch.race} {ch.class} L{level}
                  </span>
                  <span className="shrink-0 tabular-nums">XP {xp}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const { party } = props;
  return (
    <div className="flex h-full min-h-0 flex-col gap-1 font-mono text-[10px] uppercase leading-tight tracking-wide sm:gap-1.5 sm:text-xs sm:leading-normal">
      {party.map((p) => {
        const dead = p.hp <= 0;
        const pct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
        return (
          <div
            key={p.name}
            className={`min-h-0 flex-1 border px-1.5 py-1 sm:px-2 sm:py-1.5 ${dead ? "border-red-900 text-red-500" : "border-amber-800/70 text-amber-200"}`}
          >
            <div className="flex justify-between gap-2">
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums">
                {p.hp}/{p.maxHp}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-amber-600/80">
              <span className="truncate">
                {p.race} {p.class}
              </span>
              <span className="shrink-0 tabular-nums">XP {p.xp}</span>
            </div>
            <div className="mt-1 h-1 bg-amber-950 sm:mt-1.5 sm:h-1.5">
              <div
                className={
                  dead ? "h-1 bg-red-800 sm:h-1.5" : "h-1 bg-amber-500 sm:h-1.5"
                }
                style={{ width: `${Math.max(0, pct) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
