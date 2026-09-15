#!/usr/bin/env python3
"""Snap an image to exact IBM EGA 16 colors, half resolution, no dither."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

EGA = np.array(
    [
        (0x00, 0x00, 0x00),
        (0x00, 0x00, 0xAA),
        (0x00, 0xAA, 0x00),
        (0x00, 0xAA, 0xAA),
        (0xAA, 0x00, 0x00),
        (0xAA, 0x00, 0xAA),
        (0xAA, 0x55, 0x00),
        (0xAA, 0xAA, 0xAA),
        (0x55, 0x55, 0x55),
        (0x55, 0x55, 0xFF),
        (0x55, 0xFF, 0x55),
        (0x55, 0xFF, 0xFF),
        (0xFF, 0x55, 0x55),
        (0xFF, 0x55, 0xFF),
        (0xFF, 0xFF, 0x55),
        (0xFF, 0xFF, 0xFF),
    ],
    dtype=np.float32,
)


def snap_ega(src: Path, dest: Path, size: int) -> None:
    img = Image.open(src).convert("RGB")
    img = img.resize((size, size), Image.Resampling.BOX)
    arr = np.asarray(img, dtype=np.float32)
    mean = arr.mean(axis=2, keepdims=True)
    arr = np.clip(mean + (arr - mean) * 1.6, 0, 255)

    px = arr.reshape(-1, 3)
    chroma = px.max(axis=1) - px.min(axis=1)
    dists = ((px[:, None, :] - EGA[None, :, :]) ** 2).sum(axis=2)
    gray_idx = np.array([0, 7, 8, 15])
    penalty = np.zeros_like(dists)
    penalty[:, gray_idx] = np.where(chroma[:, None] > 25, 8000.0, 0.0)
    choice = (dists + penalty).argmin(axis=1)
    out_rgb = EGA[choice].astype(np.uint8).reshape(size, size, 3)

    out = Image.fromarray(out_rgb, "RGB")
    pal = Image.new("P", (16, 1))
    pal.putpalette(EGA.astype(np.uint8).reshape(-1).tolist() + [0] * (768 - 48))
    for i in range(16):
        pal.putpixel((i, 0), i)
    final = out.quantize(palette=pal, dither=Image.Dither.NONE)
    dest.parent.mkdir(parents=True, exist_ok=True)
    final.save(dest, optimize=True)
    colors = final.convert("RGB").getcolors(256) or []
    print(f"{dest.name}: {final.size} unique={len(colors)}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage: snap_ega.py <src> <dest> <size>", file=sys.stderr)
        sys.exit(2)
    snap_ega(Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]))
