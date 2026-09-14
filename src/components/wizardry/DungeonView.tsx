"use client";

import { useEffect, useRef, useState } from "react";
import type { Dir, DungeonResult, Pos } from "@/sim/types";

const AMBER = "#e4b45a";
const DIM = "#6a4a1a";
const MONSTER_SPRITES: Record<string, string> = {
  Goblin: "/monsters/goblin.png",
  Hobgoblin: "/monsters/hobgoblin.png",
  Bugbear: "/monsters/bugbear.png",
  Kobold: "/monsters/kobold.png",
  Skeleton: "/monsters/skeleton.png",
  Zombie: "/monsters/zombie.png",
  Wolf: "/monsters/wolf.png",
  Orc: "/monsters/orc.png",
  Ghoul: "/monsters/ghoul.png",
  // Encounter names use the roster key (`GiantSpider 1`), not the display name.
  GiantSpider: "/monsters/giant-spider.png",
};

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

function monsterSpriteKey(name: string): string | null {
  // Longer names first so "Hobgoblin" is not matched as "Goblin".
  const keys = Object.keys(MONSTER_SPRITES).sort(
    (a, b) => b.length - a.length,
  );
  return keys.find((k) => new RegExp(`\\b${k}\\b`, "i").test(name)) ?? null;
}

export function DungeonView({
  maze,
  pos,
  facing,
  inCombat,
  enemies,
}: {
  maze: DungeonResult["maze"];
  pos: Pos;
  facing: Dir;
  inCombat?: boolean;
  enemies?: string[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monsterRefs = useRef<Record<string, HTMLImageElement>>({});
  const [assets, setAssets] = useState(0);

  useEffect(() => {
    let alive = true;
    const mark = () => {
      if (alive) setAssets((n) => n + 1);
    };

    const monsterImgs = Object.entries(MONSTER_SPRITES).map(([key, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        monsterRefs.current[key] = img;
        mark();
      };
      if (img.complete && img.naturalWidth > 0) {
        monsterRefs.current[key] = img;
        mark();
      }
      return img;
    });

    return () => {
      alive = false;
      for (const img of monsterImgs) img.onload = null;
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
        const toDraw = foes
          .map((name) => {
            const key = monsterSpriteKey(name);
            return key ? monsterRefs.current[key] : undefined;
          })
          .filter((img): img is HTMLImageElement =>
            Boolean(img && img.naturalWidth > 0),
          );
        if (toDraw.length > 0) {
          const count = toDraw.length;
          const maxH =
            cssH * (count === 1 ? 0.82 : count === 2 ? 0.64 : 0.52);
          const maxW =
            cssW * (count === 1 ? 0.5 : count === 2 ? 0.36 : 0.28);
          const sizes = toDraw.map((sprite) => {
            const scale = Math.min(
              maxW / sprite.naturalWidth,
              maxH / sprite.naturalHeight,
            );
            return {
              sprite,
              w: sprite.naturalWidth * scale,
              h: sprite.naturalHeight * scale,
            };
          });
          const gap = Math.max(4, cssW * 0.015);
          const total =
            sizes.reduce((sum, s) => sum + s.w, 0) + (count - 1) * gap;
          const floorY = cssH * 0.94;
          let x = (cssW - total) / 2;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          for (const { sprite, w, h } of sizes) {
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
  }, [maze, pos, facing, inCombat, assets, (enemies ?? []).join("\0")]);

  return (
    <div
      ref={wrapRef}
      className="min-h-0 w-full flex-1 overflow-hidden border border-amber-700/60 bg-black"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        aria-label={
          inCombat
            ? `First-person dungeon view, fighting ${(enemies ?? []).join(", ") || "monsters"}`
            : "First-person dungeon view"
        }
      />
    </div>
  );
}
