import { describe, expect, it } from "vitest";
import { levelForXp } from "./leveling";

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
