"use client";

import { useEffect, useRef, useState } from "react";
import type { Dir, DungeonResult, Pos } from "@/sim/types";

const AMBER = "#e4b45a";
const DIM = "#6a4a1a";
const GOBLIN_SRC = "/monsters/goblin.png";
const TAVERN_SRC = "/places/tavern.jpg";

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

function isGoblinoid(name: string): boolean {
  return /goblin/i.test(name);
}

function drawDeadEnd(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  mural: HTMLImageElement | null,
) {
  ctx.fillStyle = "#050301";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = Math.max(1.25, cssW / 280);

  const near = rect(0, cssW, cssH);
  const far = rect(1.15, cssW, cssH);

  ctx.beginPath();
  ctx.moveTo(near.x, near.y);
  ctx.lineTo(far.x, far.y);
  ctx.moveTo(near.x, near.y + near.h);
  ctx.lineTo(far.x, far.y + far.h);
  ctx.moveTo(near.x + near.w, near.y);
  ctx.lineTo(far.x + far.w, far.y);
  ctx.moveTo(near.x + near.w, near.y + near.h);
  ctx.lineTo(far.x + far.w, far.y + far.h);
  ctx.stroke();
  ctx.strokeRect(far.x, far.y, far.w, far.h);

  if (mural && mural.naturalWidth > 0) {
    const pad = Math.max(2, cssW * 0.01);
    const box = {
      x: far.x + pad,
      y: far.y + pad,
      w: far.w - pad * 2,
      h: far.h - pad * 2,
    };
    const scale = Math.max(
      box.w / mural.naturalWidth,
      box.h / mural.naturalHeight,
    );
    const sw = box.w / scale;
    const sh = box.h / scale;
    const sx = (mural.naturalWidth - sw) / 2;
    const sy = (mural.naturalHeight - sh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mural, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
    ctx.strokeStyle = AMBER;
    ctx.strokeRect(far.x, far.y, far.w, far.h);
  }
}

export function DungeonView({
  maze,
  pos,
  facing,
  inCombat,
  enemies,
  scene = "maze",
}: {
  maze?: DungeonResult["maze"];
  pos?: Pos;
  facing?: Dir;
  inCombat?: boolean;
  enemies?: string[];
  scene?: "maze" | "town";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const goblinRef = useRef<HTMLImageElement | null>(null);
  const tavernRef = useRef<HTMLImageElement | null>(null);
  const [assets, setAssets] = useState(0);

  useEffect(() => {
    let alive = true;
    const mark = () => {
      if (alive) setAssets((n) => n + 1);
    };

    const goblin = new Image();
    goblin.src = GOBLIN_SRC;
    goblin.onload = () => {
      goblinRef.current = goblin;
      mark();
    };
    if (goblin.complete && goblin.naturalWidth > 0) {
      goblinRef.current = goblin;
      mark();
    }

    const tavern = new Image();
    tavern.src = TAVERN_SRC;
    tavern.onload = () => {
      tavernRef.current = tavern;
      mark();
    };
    if (tavern.complete && tavern.naturalWidth > 0) {
      tavernRef.current = tavern;
      mark();
    }

    return () => {
      alive = false;
      goblin.onload = null;
      tavern.onload = null;
    };
  }, []);

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

      if (scene === "town") {
        drawDeadEnd(ctx, cssW, cssH, tavernRef.current);
        return;
      }

      if (!maze || !pos || !facing) return;

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
        const foes = enemies ?? [];
        const sprite = goblinRef.current;
        const count = Math.min(
          2,
          Math.max(1, foes.filter(isGoblinoid).length || foes.length),
        );
        if (sprite && sprite.naturalWidth > 0) {
          const maxH = cssH * (count === 1 ? 0.82 : 0.64);
          const maxW = cssW * (count === 1 ? 0.5 : 0.36);
          const scale = Math.min(
            maxW / sprite.naturalWidth,
            maxH / sprite.naturalHeight,
          );
          const w = sprite.naturalWidth * scale;
          const h = sprite.naturalHeight * scale;
          const gap = Math.max(6, cssW * 0.02);
          const total = count * w + (count - 1) * gap;
          const floorY = cssH * 0.94;
          let x = (cssW - total) / 2;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          for (let i = 0; i < count; i++) {
            ctx.drawImage(sprite, x, floorY - h, w, h);
            x += w + gap;
          }
        }
        ctx.fillStyle = AMBER;
        ctx.font = `600 ${Math.max(11, Math.round(cssW / 28))}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("FIGHT", cssW / 2, Math.max(6, cssH * 0.04));
      }
    };

    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    draw();
    return () => ro.disconnect();
  }, [scene, maze, pos, facing, inCombat, assets, (enemies ?? []).join("\0")]);

  return (
    <div
      ref={wrapRef}
      className="min-h-0 w-full flex-1 overflow-hidden border border-amber-700/60 bg-black"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        aria-label={
          scene === "town"
            ? "First-person view of a tavern at the end of the street"
            : inCombat
              ? `First-person dungeon view, fighting ${(enemies ?? []).join(", ") || "monsters"}`
              : "First-person dungeon view"
        }
      />
    </div>
  );
}
