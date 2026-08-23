import type { PartySnapshot } from "@/sim/types";

export function PartyRoster({ party }: { party: PartySnapshot[] }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide">
      {party.map((p) => {
        const dead = p.hp <= 0;
        const pct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
        return (
          <div
            key={p.name}
            className={`border px-2 py-1.5 phone-land:py-1 ${dead ? "border-red-900 text-red-500" : "border-amber-800/70 text-amber-200"}`}
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
            <div className="mt-1.5 h-1.5 bg-amber-950 phone-land:hidden">
              <div
                className={dead ? "h-1.5 bg-red-800" : "h-1.5 bg-amber-500"}
                style={{ width: `${Math.max(0, pct) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
