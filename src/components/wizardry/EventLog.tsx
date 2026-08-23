"use client";

import { useEffect, useRef } from "react";
import { describeEvent, isNarrative } from "@/replay/project";
import type { LogEvent } from "@/sim/types";

export function EventLog({
  log,
  cursor,
}: {
  log: LogEvent[];
  cursor: number;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const lines = log
    .map((e, i) => ({ e, i, text: describeEvent(e) }))
    .filter((x) => x.text && isNarrative(x.e) && x.i <= cursor)
    .slice(-24);

  useEffect(() => {
    const list = listRef.current;
    const end = endRef.current;
    if (!list || !end) return;
    list.scrollTop = end.offsetTop - list.clientHeight + end.offsetHeight + 8;
  }, [cursor, lines.length]);

  return (
    <ol
      ref={listRef}
      className="relative max-h-[22dvh] min-h-24 flex-1 overflow-y-auto overscroll-contain border border-amber-800/60 bg-black/60 p-2 font-mono text-xs leading-5 text-amber-300 md:max-h-48"
    >
      {lines.map((x, idx) => (
        <li
          key={x.i}
          ref={idx === lines.length - 1 ? endRef : undefined}
          className={x.i === cursor ? "text-amber-100" : "text-amber-400/80"}
        >
          {x.text}
        </li>
      ))}
    </ol>
  );
}
