/** Deterministic PRNG. Same seed always yields the same stream. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function d(rng: Rng, sides: number): number {
  return Math.floor(rng() * sides) + 1;
}

export function dice(rng: Rng, count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += d(rng, sides);
  return total;
}

/**
 * Roll `count` dice; any result ≤ `threshold` is rerolled once (must keep the
 * second roll even if still ≤ threshold). Used for Great Weapon Fighting.
 */
export function diceRerollLow(
  rng: Rng,
  count: number,
  sides: number,
  threshold = 2,
): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    let roll = d(rng, sides);
    if (roll <= threshold) roll = d(rng, sides);
    total += roll;
  }
  return total;
}

export function pickIndex(rng: Rng, length: number): number {
  return Math.floor(rng() * length);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("pick() called with an empty list");
  }
  return items[pickIndex(rng, items.length)]!;
}

/** Sample `n` items without replacement. Order is pick order, not sorted. */
export function sample<T>(rng: Rng, items: readonly T[], n: number): T[] {
  const pool = items.slice();
  const take = Math.min(n, pool.length);
  const out: T[] = [];
  for (let i = 0; i < take; i++) {
    const idx = pickIndex(rng, pool.length);
    out.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return out;
}
