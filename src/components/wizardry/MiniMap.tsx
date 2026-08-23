import type { DungeonResult } from "@/sim/types";
import type { ReplayFrame } from "@/replay/project";

export function MiniMap({
  maze,
  frame,
}: {
  maze: DungeonResult["maze"];
  frame: ReplayFrame;
}) {
  const seen = new Set(frame.visited);
  const cell = 8;
  const size = maze.size * cell;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="aspect-square w-full max-w-[8.5rem] shrink-0 border border-amber-700/60 bg-black phone-land:max-w-[9rem] sm:max-w-[12.5rem]"
      aria-label="Maze map"
    >
      {maze.grid.flatMap((row, y) =>
        row.map((c, x) => {
          const key = `${x},${y}`;
          const isHere = frame.pos.x === x && frame.pos.y === y;
          const isExit = maze.exit.x === x && maze.exit.y === y;
          const isEnt = maze.entrance.x === x && maze.entrance.y === y;
          const fill = isHere
            ? "#e4b45a"
            : isExit
              ? "#3d8"
              : isEnt
                ? "#68a"
                : seen.has(key)
                  ? "#3a2a10"
                  : "#0a0804";
          const px = x * cell;
          const py = y * cell;
          return (
            <g key={key}>
              <rect x={px} y={py} width={cell} height={cell} fill={fill} />
              {c.n && (
                <line
                  x1={px}
                  y1={py}
                  x2={px + cell}
                  y2={py}
                  stroke="#c48a30"
                  strokeWidth="1"
                />
              )}
              {c.w && (
                <line
                  x1={px}
                  y1={py}
                  x2={px}
                  y2={py + cell}
                  stroke="#c48a30"
                  strokeWidth="1"
                />
              )}
              {c.s && y === maze.size - 1 && (
                <line
                  x1={px}
                  y1={py + cell}
                  x2={px + cell}
                  y2={py + cell}
                  stroke="#c48a30"
                  strokeWidth="1"
                />
              )}
              {c.e && x === maze.size - 1 && (
                <line
                  x1={px + cell}
                  y1={py}
                  x2={px + cell}
                  y2={py + cell}
                  stroke="#c48a30"
                  strokeWidth="1"
                />
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
