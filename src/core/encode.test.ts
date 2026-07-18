import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { EC_LEVELS, type ECLevel } from "./capacity";
import { chooseVersion, encode } from "./encode";
import { getModule, type QRMatrix } from "./matrix";
import { detectMode } from "./segments";

/**
 * Rasterizes a matrix into RGBA pixels (1 module = scale px, quiet zone
 * around it). A helper for round-trip verification through jsQR, an
 * independently implemented decoder.
 */
function rasterize(m: QRMatrix, scale = 4, quiet = 4) {
  const px = (m.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (getModule(m, x, y) === 0) continue;
      for (let dy = 0; dy < scale; dy++) {
        const rowBase = ((y + quiet) * scale + dy) * px;
        for (let dx = 0; dx < scale; dx++) {
          const i = (rowBase + (x + quiet) * scale + dx) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: px, height: px };
}

function decode(m: QRMatrix) {
  const img = rasterize(m);
  const result = jsQR(img.data, img.width, img.height);
  expect(result, `v${m.version}-${m.ecLevel} mask${m.mask} failed to decode`).not.toBeNull();
  return result!;
}

describe("encode → jsQR round trip", () => {
  it.each([
    ["0123456789012345", "Numeric"],
    ["HELLO WORLD $%*+-./:", "Alphanumeric"],
    ["https://example.com/path?q=1&x=abc#frag", "URL(byte)"],
    ["mixed Case with lower 123", "byte"],
  ])("%s (%s)", (text) => {
    expect(decode(encode(text)).data).toBe(text);
  });

  it("Japanese mixed with ASCII (→ byte mode/UTF-8) matches as a byte sequence", () => {
    const text = "こんにちは、世界!QRコード🎌";
    expect(detectMode(text)).toBe("byte");
    const result = decode(encode(text));
    expect(new Uint8Array(result.binaryData)).toEqual(
      new TextEncoder().encode(text),
    );
  });

  it("all-double-byte Japanese encodes in kanji mode and decodes with jsQR", () => {
    const text = "漢字モードの試験、句読点。カタカナも全角Ａも";
    expect(detectMode(text)).toBe("kanji");
    const m = encode(text);
    expect(decode(m).data).toBe(text);
    // Fits a smaller version than encoding the same string as UTF-8 bytes
    const utf8 = new TextEncoder().encode(text);
    const byteVersion = encode(utf8).version;
    expect(m.version).toBeLessThanOrEqual(byteVersion);
  });

  it("kanji mode round-trips at every EC level", () => {
    for (const ecLevel of ["L", "M", "Q", "H"] as ECLevel[]) {
      expect(decode(encode("誤り訂正水準試験", { ecLevel })).data).toBe(
        "誤り訂正水準試験",
      );
    }
  });

  it("kanji-mode capacity boundary v1-L (10 chars)", () => {
    const text = "熙".repeat(10);
    const m = encode(text, { ecLevel: "L" });
    expect(m.version).toBe(1);
    expect(decode(m).data).toBe(text);
  });

  it("all error correction levels", () => {
    for (const ecLevel of ["L", "M", "Q", "H"] as ECLevel[]) {
      const m = encode("EC LEVEL TEST 123", { ecLevel });
      expect(m.ecLevel).toBe(ecLevel);
      expect(decode(m).data).toBe("EC LEVEL TEST 123");
    }
  });

  it("all 8 masks forced", () => {
    for (let mask = 0; mask < 8; mask++) {
      const m = encode("MASK ROUND TRIP", { mask });
      expect(m.mask).toBe(mask);
      expect(decode(m).data).toBe("MASK ROUND TRIP");
    }
  });

  it("pinned versions (multiple alignment patterns, version info, spanning all version bands)", () => {
    for (const version of [2, 5, 6, 7, 10, 14, 26, 27, 32, 40]) {
      const m = encode("VERSION PIN TEST", { version, ecLevel: "Q" });
      expect(m.version).toBe(version);
      expect(m.size).toBe(version * 4 + 17);
      expect(decode(m).data).toBe("VERSION PIN TEST");
    }
  });

  it("maximum capacity: 7089 digits (v40-L)", () => {
    const digits = "8".repeat(7089);
    const m = encode(digits, { ecLevel: "L" });
    expect(m.version).toBe(40);
    expect(decode(m).data).toBe(digits);
  });

  it("empty string becomes a v1 symbol with an empty numeric segment", () => {
    const m = encode("");
    expect(m.version).toBe(1);
    expect(decode(m).data).toBe("");
  });

  it("Uint8Array input (binary data)", () => {
    const bytes = new Uint8Array(64).map((_, i) => (i * 37 + 5) & 0xff);
    const result = decode(encode(bytes, { ecLevel: "M" }));
    expect(new Uint8Array(result.binaryData)).toEqual(bytes);
  });

  it("auto-selected and pinned masks decode the same data (consistency)", () => {
    const text = "CONSISTENCY";
    const auto = encode(text);
    expect(auto.mask).toBeGreaterThanOrEqual(0);
    expect(auto.mask).toBeLessThanOrEqual(7);
    expect(decode(auto).data).toBe(text);
    expect(decode(encode(text, { mask: auto.mask })).data).toBe(text);
  });
});

describe("exhaustive sweep: jsQR round trip over all 40 versions × all EC levels", () => {
  it.each(Array.from({ length: 40 }, (_, i) => i + 1))(
    "v%i × L/M/Q/H",
    (version) => {
      for (const ecLevel of EC_LEVELS) {
        const text = `V${version}-${ecLevel}`;
        const m = encode(text, { version, ecLevel });
        expect(m.version).toBe(version);
        expect(m.ecLevel).toBe(ecLevel);
        // jsQR's version table has a typo in v23's alignment pattern centers
        // ([6,30,54,74,102] where the spec — and ZXing, qrcode-generator —
        // says 78, the only value consistent with the equal-step rule). The
        // resulting misplaced function-pattern mask garbles more codewords
        // than L's EC budget can absorb (M/Q/H still correct them). A jsQR
        // copy with the table fixed decodes our v23-L at all 8 masks, so the
        // encoder side is correct; skip only this decoder-bug combination.
        if (version === 23 && ecLevel === "L") continue;
        expect(decode(m).data).toBe(text);
      }
    },
  );
});

describe("chooseVersion (public API): returns the version directly from data", () => {
  it("matches the version encode auto-selects (default is level M)", () => {
    for (const data of ["HI", "1".repeat(200), "x".repeat(100), "こんにちは"]) {
      expect(chooseVersion(data)).toBe(encode(data).version);
    }
    const bytes = new Uint8Array(64);
    expect(chooseVersion(bytes)).toBe(encode(bytes).version);
  });

  it("respects ecLevel / minVersion", () => {
    expect(chooseVersion("x".repeat(17), { ecLevel: "L" })).toBe(1);
    expect(chooseVersion("x".repeat(17), { ecLevel: "H" })).toBe(3);
    expect(chooseVersion("HI", { minVersion: 5 })).toBe(5);
  });

  it("allowKanji: false selects the version as byte mode", () => {
    const text = "漢".repeat(30);
    expect(chooseVersion(text, { allowKanji: false })).toBe(
      chooseVersion(new TextEncoder().encode(text)),
    );
    expect(chooseVersion(text)).toBeLessThanOrEqual(
      chooseVersion(text, { allowKanji: false }),
    );
  });

  it("same input validation as encode (type, length cap, invalid minVersion)", () => {
    expect(() => chooseVersion(123 as unknown as string)).toThrow(
      /string or Uint8Array/,
    );
    expect(() => chooseVersion("8".repeat(7090), { ecLevel: "L" })).toThrow(
      /too long/,
    );
    expect(() => chooseVersion("HI", { minVersion: 0 })).toThrow(RangeError);
  });
});

describe("encode: options", () => {
  it("never selects below minVersion", () => {
    expect(encode("HI", { minVersion: 5 }).version).toBe(5);
  });

  it("defaults are level M and the smallest version", () => {
    const m = encode("HI");
    expect(m.ecLevel).toBe("M");
    expect(m.version).toBe(1);
  });

  it("invalid version is RangeError, capacity overflow is Error", () => {
    expect(() => encode("X", { version: 0 })).toThrow(RangeError);
    expect(() => encode("X", { version: 41 })).toThrow(RangeError);
    expect(() => encode("x".repeat(100), { version: 1 })).toThrow(/exceeds/);
  });

  it("invalid minVersion is RangeError (not a 'does not fit' Error)", () => {
    expect(() => encode("X", { minVersion: 41 })).toThrow(RangeError);
    expect(() => encode("X", { minVersion: 0 })).toThrow(RangeError);
  });

  it("lengths that cannot fit any version fail fast with Error (just above the boundary)", () => {
    // Strings: 7,089 UTF-16 code units (Numeric at v40-L) is the hard maximum
    expect(() => encode("8".repeat(7090), { ecLevel: "L" })).toThrow(/too long/);
    // Uint8Array: 2,953 bytes (Byte at v40-L) is the hard maximum
    expect(() => encode(new Uint8Array(2954), { ecLevel: "L" })).toThrow(
      /too long/,
    );
  });

  it("allowKanji: false encodes all-double-byte strings in byte mode too (same matrix as UTF-8 byte input)", () => {
    const text = "環境非依存の出力";
    const m = encode(text, { allowKanji: false });
    const byte = encode(new TextEncoder().encode(text));
    expect(m.version).toBe(byte.version);
    expect(m.mask).toBe(byte.mask);
    expect(m.modules).toEqual(byte.modules);
    expect(decode(m).data).toBe(text);
  });

  it("data that is neither a string nor a Uint8Array is RangeError", () => {
    for (const bad of [null, undefined, 123, [1, 2, 3], {}] as unknown[]) {
      expect(() => encode(bad as string)).toThrow(RangeError);
      expect(() => encode(bad as string)).toThrow(/string or Uint8Array/);
    }
  });
});
