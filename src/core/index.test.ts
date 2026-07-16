import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("公開APIサーフェス", () => {
  it("意図したエクスポートのみを公開する(内部実装を漏らさない)", () => {
    expect(Object.keys(core).sort()).toEqual([
      "chooseVersion",
      "detectMode",
      "encode",
      "getModule",
      "toSvgPath",
    ]);
  });
});
