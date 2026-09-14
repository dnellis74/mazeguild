import { describe, expect, it } from "vitest";
import { levelForXp, xpForNextLevel } from "./leveling";

describe("levelForXp", () => {
  it("is level 1 at 0 XP", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("reaches level 2 at 300 XP", () => {
    expect(levelForXp(300)).toBe(2);
  });

  it("stays level 1 just under the threshold", () => {
    expect(levelForXp(299)).toBe(1);
  });
});

describe("xpForNextLevel", () => {
  it("is 300 while still level 1", () => {
    expect(xpForNextLevel(0)).toBe(300);
    expect(xpForNextLevel(299)).toBe(300);
  });

  it("is 900 at level 2", () => {
    expect(xpForNextLevel(300)).toBe(900);
  });

  it("returns the max-level threshold at level 20", () => {
    expect(xpForNextLevel(355_000)).toBe(355_000);
  });
});
