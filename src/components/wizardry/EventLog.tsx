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
    .filter((x) => x.text && isNarrative(x.e) && x.i <= cursor);

  useEffect(() => {
    const list = listRef.current;
    const end = endRef.current;
    if (!list || !end) return;
    list.scrollTop = end.offsetTop - list.clientHeight + end.offsetHeight + 8;
  }, [cursor, lines.length]);

  return (
    <ol
      ref={listRef}
      className="h-[22dvh] shrink-0 overflow-y-auto overscroll-contain border border-ega-dark-gray bg-black/60 p-2 font-mono text-xs leading-5 text-ega-light-gray sm:h-48"
    >
      {lines.map((x, idx) => (
        <li
          key={x.i}
          ref={idx === lines.length - 1 ? endRef : undefined}
          className={x.i === cursor ? "text-ega-white" : "text-ega-cyan"}
        >
          {x.text}
        </li>
      ))}
    </ol>
  );
}
