import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("public API surface", () => {
  it("exposes only the intended exports (no internal leaks)", () => {
    expect(Object.keys(core).sort()).toEqual([
      "chooseVersion",
      "detectMode",
      "encode",
      "getModule",
      "toSvgPath",
    ]);
  });
});
