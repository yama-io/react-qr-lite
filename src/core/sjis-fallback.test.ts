import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Verifies the fallback behavior in environments whose TextDecoder lacks
 * shift_jis (some edge runtimes) by mocking TextDecoder. Since sjis.ts
 * caches its table in a module variable, each case re-evaluates a fresh
 * instance via resetModules + dynamic import.
 */
describe("sjis: fallback in environments without shift_jis support", () => {
  const RealTextDecoder = globalThis.TextDecoder;

  afterEach(() => {
    globalThis.TextDecoder = RealTextDecoder;
    vi.resetModules();
  });

  async function importWithBrokenDecoder() {
    vi.resetModules();
    globalThis.TextDecoder = class {
      constructor(label?: string) {
        if (label !== undefined && label !== "utf-8") {
          throw new RangeError(`unsupported encoding: ${label}`);
        }
      }
      decode(): string {
        return "";
      }
    } as unknown as typeof TextDecoder;
    return {
      sjis: await import("./sjis"),
      segments: await import("./segments"),
    };
  }

  it("kanjiModeAvailable becomes false and sjisCode returns undefined", async () => {
    const { sjis } = await importWithBrokenDecoder();
    expect(sjis.kanjiModeAvailable()).toBe(false);
    expect(sjis.sjisCode("あ")).toBeUndefined();
    expect(sjis.isKanjiEncodable("こんにちは")).toBe(false);
  });

  it("detectMode returns byte even for all-double-byte strings (encoding succeeds)", async () => {
    const { segments } = await importWithBrokenDecoder();
    expect(segments.detectMode("こんにちは")).toBe("byte");
    const segs = segments.makeSegments("こんにちは");
    expect(segs[0]!.mode).toBe("byte"); // encodes fine in UTF-8 byte mode
  });

  it("an explicit makeKanjiSegment call throws a clear error", async () => {
    const { segments } = await importWithBrokenDecoder();
    expect(() => segments.makeKanjiSegment("あ")).toThrow(/not encodable/);
  });
});
