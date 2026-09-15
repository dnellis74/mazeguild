import type { PartySnapshot } from "@/sim/types";

/** Side roster during a maze run (snapshots only). */
export function PartyRoster({ party }: { party: PartySnapshot[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-1 font-mono text-[10px] uppercase leading-tight tracking-wide sm:gap-1.5 sm:text-xs sm:leading-normal">
      <p className="shrink-0 text-ega-yellow">PARTY</p>
      {party.map((p) => {
        const dead = p.hp <= 0;
        const pct = p.maxHp > 0 ? p.hp / p.maxHp : 0;
        return (
          <div
            key={p.name}
            className={`min-h-0 flex-1 border px-1.5 py-1 sm:px-2 sm:py-1.5 ${dead ? "border-ega-red text-ega-bright-red" : "border-ega-dark-gray text-ega-light-gray"}`}
          >
            <div className="flex justify-between gap-2">
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums">
                {p.hp}/{p.maxHp}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-ega-brown">
              <span className="truncate">
                {p.race} {p.summary}
              </span>
              <span className="shrink-0 tabular-nums">XP {p.xp}</span>
            </div>
            <div className="mt-1 h-1 bg-ega-black sm:mt-1.5 sm:h-1.5">
              <div
                className={
                  dead ? "h-1 bg-ega-bright-red sm:h-1.5" : "h-1 bg-ega-bright-green sm:h-1.5"
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
