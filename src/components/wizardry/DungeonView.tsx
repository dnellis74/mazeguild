"use client";

import { useEffect, useRef, useState } from "react";
import type { Dir, DungeonResult, Pos } from "@/sim/types";

/** Pool of Radiance–style EGA maze fills */
const CEILING = "#FFFFFF";
const WALL = "#AAAAAA";
const FLOOR = "#AA5500";
const OUTLINE = "#000000";
const FIGHT = "#55FFFF";

const MONSTER_SPRITES: Record<string, string> = {
  Goblin: "/monsters/goblin-color.png",
  Hobgoblin: "/monsters/hobgoblin-color.png",
  Bugbear: "/monsters/bugbear-color.png",
  Kobold: "/monsters/kobold-color.png",
  Skeleton: "/monsters/skeleton-color.png",
  Zombie: "/monsters/zombie-color.png",
  Wolf: "/monsters/wolf-color.png",
  Orc: "/monsters/orc-color.png",
  Ghoul: "/monsters/ghoul-color.png",
  // Encounter names use the roster key (`GiantSpider 1`), not the display name.
  GiantSpider: "/monsters/giant-spider-color.png",
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

type R = ReturnType<typeof rect>;

function fillPoly(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  fill: string,
) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

/** Left side-passage: floor/ceiling wedge + far wall face (not a flat door). */
function drawLeftBranch(ctx: CanvasRenderingContext2D, a: R, b: R) {
  // How far the branch pushes toward the screen edge (perspective inset mirrored out).
  const inset = b.x - a.x;
  const outN = Math.max(0, a.x - inset);
  const outF = Math.max(0, a.x - inset * 0.75);

  // Branch ceiling
  fillPoly(
    ctx,
    [
      [outN, a.y],
      [a.x, a.y],
      [b.x, b.y],
      [outF, b.y],
    ],
    CEILING,
  );
  // Branch floor
  fillPoly(
    ctx,
    [
      [outN, a.y + a.h],
      [a.x, a.y + a.h],
      [b.x, b.y + b.h],
      [outF, b.y + b.h],
    ],
    FLOOR,
  );
  // Outer wall of the side corridor (facing back toward the main hall)
  if (outN < a.x - 0.5 || outF < b.x - 0.5) {
    fillPoly(
      ctx,
      [
        [outN, a.y],
        [outF, b.y],
        [outF, b.y + b.h],
        [outN, a.y + a.h],
      ],
      WALL,
    );
  }
  // Far face of the branch (what you see looking into the side passage)
  fillPoly(
    ctx,
    [
      [outF, b.y],
      [b.x, b.y],
      [b.x, b.y + b.h],
      [outF, b.y + b.h],
    ],
    WALL,
  );
  // Near jamb (thin wall lip on the main corridor)
  const jamb = Math.max(1.5, inset * 0.15);
  fillPoly(
    ctx,
    [
      [a.x, a.y],
      [a.x + jamb, a.y + (b.y - a.y) * 0.08],
      [a.x + jamb, a.y + a.h - (a.y + a.h - (b.y + b.h)) * 0.08],
      [a.x, a.y + a.h],
    ],
    WALL,
  );
}

/** Right side-passage (mirror of left). */
function drawRightBranch(ctx: CanvasRenderingContext2D, a: R, b: R) {
  const aR = a.x + a.w;
  const bR = b.x + b.w;
  const inset = aR - bR;
  const outN = aR + inset;
  const outF = bR + inset * 0.75;

  fillPoly(
    ctx,
    [
      [aR, a.y],
      [outN, a.y],
      [outF, b.y],
      [bR, b.y],
    ],
    CEILING,
  );
  fillPoly(
    ctx,
    [
      [aR, a.y + a.h],
      [outN, a.y + a.h],
      [outF, b.y + b.h],
      [bR, b.y + b.h],
    ],
    FLOOR,
  );
  fillPoly(
    ctx,
    [
      [outN, a.y],
      [outF, b.y],
      [outF, b.y + b.h],
      [outN, a.y + a.h],
    ],
    WALL,
  );
  fillPoly(
    ctx,
    [
      [bR, b.y],
      [outF, b.y],
      [outF, b.y + b.h],
      [bR, b.y + b.h],
    ],
    WALL,
  );
  const jamb = Math.max(1.5, inset * 0.15);
  fillPoly(
    ctx,
    [
      [aR, a.y],
      [aR - jamb, a.y + (b.y - a.y) * 0.08],
      [aR - jamb, a.y + a.h - (a.y + a.h - (b.y + b.h)) * 0.08],
      [aR, a.y + a.h],
    ],
    WALL,
  );
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

      ctx.fillStyle = OUTLINE;
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.lineWidth = Math.max(1, cssW / 320);
      ctx.lineJoin = "miter";

      const depths: boolean[] = [];
      for (let d = 0; d < 6; d++) {
        const cell = ahead(pos, facing, d);
        depths.push(hasWall(maze, cell, facing));
        if (hasWall(maze, cell, facing)) break;
      }

      let blockedAt = depths.findIndex(Boolean);
      if (blockedAt === -1) blockedAt = depths.length - 1;

      // Far → near so nearer planes cover seams (painter's algorithm).
      for (let d = blockedAt; d >= 0; d--) {
        const cell = ahead(pos, facing, d);
        const a: R = rect(d, cssW, cssH);
        const b: R = rect(d + 1, cssW, cssH);
        const leftWall = hasWall(maze, cell, leftOf(facing));
        const rightWall = hasWall(maze, cell, rightOf(facing));
        const forwardWall =
          hasWall(maze, cell, facing) || d === blockedAt;

        fillPoly(
          ctx,
          [
            [a.x, a.y],
            [a.x + a.w, a.y],
            [b.x + b.w, b.y],
            [b.x, b.y],
          ],
          CEILING,
        );
        fillPoly(
          ctx,
          [
            [a.x, a.y + a.h],
            [a.x + a.w, a.y + a.h],
            [b.x + b.w, b.y + b.h],
            [b.x, b.y + b.h],
          ],
          FLOOR,
        );

        if (leftWall) {
          fillPoly(
            ctx,
            [
              [a.x, a.y],
              [b.x, b.y],
              [b.x, b.y + b.h],
              [a.x, a.y + a.h],
            ],
            WALL,
          );
        } else {
          drawLeftBranch(ctx, a, b);
        }

        if (rightWall) {
          fillPoly(
            ctx,
            [
              [a.x + a.w, a.y],
              [b.x + b.w, b.y],
              [b.x + b.w, b.y + b.h],
              [a.x + a.w, a.y + a.h],
            ],
            WALL,
          );
        } else {
          drawRightBranch(ctx, a, b);
        }

        if (forwardWall) {
          fillPoly(
            ctx,
            [
              [b.x, b.y],
              [b.x + b.w, b.y],
              [b.x + b.w, b.y + b.h],
              [b.x, b.y + b.h],
            ],
            WALL,
          );
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
          ctx.imageSmoothingEnabled = false;
          for (const { sprite, w, h } of sizes) {
            ctx.drawImage(sprite, x, floorY - h, w, h);
            x += w + gap;
          }
        }
        ctx.fillStyle = FIGHT;
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
      className="min-h-0 w-full flex-1 overflow-hidden border border-ega-dark-gray bg-black"
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
