import { describe, expect, it } from "vitest";
import { placeImageSrc, placeSlug } from "./placeImage";

describe("placeImage", () => {
  it("slugs catalog names to place filenames", () => {
    expect(placeSlug("Town Gate")).toBe("town-gate");
    expect(placeSlug("The Keep")).toBe("keep");
    expect(placeSlug("The Wilds")).toBe("wilds");
    expect(placeSlug("Walled City")).toBe("walled-city");
    expect(placeSlug("Tavern")).toBe("tavern");
    expect(placeSlug("Town Square")).toBe("town-square");
  });

  it("returns src only for known place art", () => {
    expect(placeImageSrc("The Keep")).toBe("/places/keep.jpg");
    expect(placeImageSrc("Cathedral")).toBeNull();
    expect(placeImageSrc("")).toBeNull();
  });
});
