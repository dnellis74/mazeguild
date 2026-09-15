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

  it("returns EGA color variants for known place art", () => {
    expect(placeImageSrc("The Keep")).toBe("/places/keep-color.png");
    expect(placeImageSrc("Town Square")).toBe(
      "/places/town-square-color.png",
    );
    expect(placeImageSrc("Town Gate")).toBe("/places/town-gate-color.png");
    expect(placeImageSrc("Tavern")).toBe("/places/tavern-color.png");
    expect(placeImageSrc("Walled City")).toBe(
      "/places/walled-city-color.png",
    );
    expect(placeImageSrc("The Wilds")).toBe("/places/wilds-color.png");
    expect(placeImageSrc("Cathedral")).toBeNull();
    expect(placeImageSrc("")).toBeNull();
  });
});
