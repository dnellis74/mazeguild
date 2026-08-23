"use client";

import { useEffect, useRef } from "react";
import type { Dir, DungeonResult, Pos } from "@/sim/types";

const AMBER = "#e4b45a";
const DIM = "#6a4a1a";

function hasWall(
  maze: DungeonResult["maze"],
  pos: Pos,
  dir: Dir,
): boolean {
  if (
    pos.x < 0 ||
    pos.y < 0 ||
    pos.x >= maze.size ||
    pos.y >= maze.size
  ) {
    return true;
  }
  return maze.grid[pos.y][pos.x][dir];
}

function ahead(pos: Pos, facing: Dir, dist: number): Pos {
  const d = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[facing];
  return { x: pos.x + d[0] * dist, y: pos.y + d[1] * dist };
}

function leftOf(dir: Dir): Dir {
  return ({ n: "w", w: "s", s: "e", e: "n" } as const)[dir];
}

function rightOf(dir: Dir): Dir {
  return ({ n: "e", e: "s", s: "w", w: "n" } as const)[dir];
}

function rect(depth: number, w: number, h: number) {
  const t = depth / 6;
  const ix = t * w * 0.42;
  const iy = t * h * 0.42;
  return { x: ix, y: iy, w: w - ix * 2, h: h - iy * 2 };
}

export function DungeonView({
  maze,
  pos,
  facing,
  inCombat,
}: {
  maze: DungeonResult["maze"];
  pos: Pos;
  facing: Dir;
  inCombat: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const box = wrap.getBoundingClientRect();
      const cssW = Math.max(1, Math.round(box.width));
      const cssH = Math.max(1, Math.round(box.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = "#050301";
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = Math.max(1.25, cssW / 280);

      const depths: boolean[] = [];
      for (let d = 0; d < 6; d++) {
        const cell = ahead(pos, facing, d);
        depths.push(hasWall(maze, cell, facing));
        if (hasWall(maze, cell, facing)) break;
      }

      let blockedAt = depths.findIndex(Boolean);
      if (blockedAt === -1) blockedAt = depths.length - 1;

      for (let d = 0; d <= blockedAt; d++) {
        const cell = ahead(pos, facing, d);
        const a = rect(d, cssW, cssH);
        const b = rect(d + 1, cssW, cssH);
        const leftWall = hasWall(maze, cell, leftOf(facing));
        const rightWall = hasWall(maze, cell, rightOf(facing));

        ctx.beginPath();
        if (leftWall) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.moveTo(a.x, a.y + a.h);
          ctx.lineTo(b.x, b.y + b.h);
        } else {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x, a.y + a.h);
          ctx.moveTo(a.x, b.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(b.x, b.y + b.h);
          ctx.lineTo(a.x, b.y + b.h);
        }
        if (rightWall) {
          ctx.moveTo(a.x + a.w, a.y);
          ctx.lineTo(b.x + b.w, b.y);
          ctx.moveTo(a.x + a.w, a.y + a.h);
          ctx.lineTo(b.x + b.w, b.y + b.h);
        } else {
          ctx.moveTo(a.x + a.w, a.y);
          ctx.lineTo(a.x + a.w, a.y + a.h);
          ctx.moveTo(a.x + a.w, b.y);
          ctx.lineTo(b.x + b.w, b.y);
          ctx.lineTo(b.x + b.w, b.y + b.h);
          ctx.lineTo(a.x + a.w, b.y + b.h);
        }
        ctx.stroke();

        if (hasWall(maze, cell, facing) || d === blockedAt) {
          ctx.strokeStyle = d === 0 ? AMBER : DIM;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = AMBER;
          break;
        }
      }

      if (inCombat) {
        ctx.fillStyle = "rgba(180, 40, 20, 0.18)";
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = AMBER;
        ctx.font = `600 ${Math.max(14, Math.round(cssW / 22))}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("! FIGHT !", cssW / 2, cssH / 2);
      }
    };

    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    draw();
    return () => ro.disconnect();
  }, [maze, pos, facing, inCombat]);

  return (
    <div
      ref={wrapRef}
      className="aspect-[8/5] h-full w-full max-h-[min(32dvh,15rem)] min-h-[9rem] overflow-hidden border border-amber-700/60 bg-black phone-land:aspect-auto phone-land:max-h-none phone-land:min-h-0 lg:max-h-[min(52dvh,28rem)]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        aria-label="First-person dungeon view"
      />
    </div>
  );
}
