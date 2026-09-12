import type { PartySnapshot, SrdCharacter } from "@/sim/types";
import { characterLabel } from "@/campaign/labels";

function fromSrd(ch: SrdCharacter): PartySnapshot {
  const hp = ch.hit_points?.value ?? 0;
  return {
    name: characterLabel(ch),
    class: ch.class,
    race: ch.race,
    hp,
    maxHp: hp,
    ac: ch.armor_class?.value ?? 10,
    xp: ch.xp ?? 0,
  };
}

/** Side roster during a maze run (or waiting at the gate before it starts). */
export function PartyRoster({
  party,
}: {
  party: PartySnapshot[] | SrdCharacter[];
}) {
  const rows: PartySnapshot[] =
    party.length > 0 && "hit_points" in party[0]!
      ? (party as SrdCharacter[]).map(fromSrd)
      : (party as PartySnapshot[]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 font-mono text-[10px] uppercase leading-tight tracking-wide sm:gap-1.5 sm:text-xs sm:leading-normal">
      <p className="shrink-0 text-amber-500">PARTY</p>
      {rows.map((p) => {
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
