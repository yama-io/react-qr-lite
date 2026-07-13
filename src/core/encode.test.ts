import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import type { ECLevel } from "./capacity";
import { encode } from "./encode";
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
  expect(result, `v${m.version}-${m.ecLevel} mask${m.mask} がデコードできない`).not.toBeNull();
  return result!;
}

describe("encode → jsQR ラウンドトリップ", () => {
  it.each([
    ["0123456789012345", "Numeric"],
    ["HELLO WORLD $%*+-./:", "Alphanumeric"],
    ["https://example.com/path?q=1&x=abc#frag", "URL(byte)"],
    ["mixed Case with lower 123", "byte"],
  ])("%s (%s)", (text) => {
    expect(decode(encode(text)).data).toBe(text);
  });

  it("日本語(ASCII混在→Byteモード/UTF-8)はバイト列として一致する", () => {
    const text = "こんにちは、世界!QRコード🎌";
    expect(detectMode(text)).toBe("byte");
    const result = decode(encode(text));
    expect(new Uint8Array(result.binaryData)).toEqual(
      new TextEncoder().encode(text),
    );
  });

  it("全角のみの日本語はKanjiモードで符号化され、jsQRでデコードできる", () => {
    const text = "漢字モードの試験、句読点。カタカナも全角Ａも";
    expect(detectMode(text)).toBe("kanji");
    const m = encode(text);
    expect(decode(m).data).toBe(text);
    // Fits a smaller version than encoding the same string as UTF-8 bytes
    const utf8 = new TextEncoder().encode(text);
    const byteVersion = encode(utf8).version;
    expect(m.version).toBeLessThanOrEqual(byteVersion);
  });

  it("Kanjiモード×全ECレベルでラウンドトリップ", () => {
    for (const ecLevel of ["L", "M", "Q", "H"] as ECLevel[]) {
      expect(decode(encode("誤り訂正水準試験", { ecLevel })).data).toBe(
        "誤り訂正水準試験",
      );
    }
  });

  it("Kanjiモードの容量境界 v1-L (10文字)", () => {
    const text = "熙".repeat(10);
    const m = encode(text, { ecLevel: "L" });
    expect(m.version).toBe(1);
    expect(decode(m).data).toBe(text);
  });

  it("全誤り訂正レベル", () => {
    for (const ecLevel of ["L", "M", "Q", "H"] as ECLevel[]) {
      const m = encode("EC LEVEL TEST 123", { ecLevel });
      expect(m.ecLevel).toBe(ecLevel);
      expect(decode(m).data).toBe("EC LEVEL TEST 123");
    }
  });

  it("全8マスク強制", () => {
    for (let mask = 0; mask < 8; mask++) {
      const m = encode("MASK ROUND TRIP", { mask });
      expect(m.mask).toBe(mask);
      expect(decode(m).data).toBe("MASK ROUND TRIP");
    }
  });

  it("バージョン固定(アライメント複数・バージョン情報・全バージョン帯を跨ぐ)", () => {
    for (const version of [2, 5, 6, 7, 10, 14, 26, 27, 32, 40]) {
      const m = encode("VERSION PIN TEST", { version, ecLevel: "Q" });
      expect(m.version).toBe(version);
      expect(m.size).toBe(version * 4 + 17);
      expect(decode(m).data).toBe("VERSION PIN TEST");
    }
  });

  it("最大容量: 数字7089桁 (v40-L)", () => {
    const digits = "8".repeat(7089);
    const m = encode(digits, { ecLevel: "L" });
    expect(m.version).toBe(40);
    expect(decode(m).data).toBe(digits);
  });

  it("空文字列は空のNumericセグメントを持つv1シンボルになる", () => {
    const m = encode("");
    expect(m.version).toBe(1);
    expect(decode(m).data).toBe("");
  });

  it("Uint8Array入力(バイナリデータ)", () => {
    const bytes = new Uint8Array(64).map((_, i) => (i * 37 + 5) & 0xff);
    const result = decode(encode(bytes, { ecLevel: "M" }));
    expect(new Uint8Array(result.binaryData)).toEqual(bytes);
  });

  it("自動選択と固定マスクで同じデータがデコードできる(整合性)", () => {
    const text = "CONSISTENCY";
    const auto = encode(text);
    expect(auto.mask).toBeGreaterThanOrEqual(0);
    expect(auto.mask).toBeLessThanOrEqual(7);
    expect(decode(auto).data).toBe(text);
    expect(decode(encode(text, { mask: auto.mask })).data).toBe(text);
  });
});

describe("encode: オプション", () => {
  it("minVersion を下回らない", () => {
    expect(encode("HI", { minVersion: 5 }).version).toBe(5);
  });

  it("既定はレベルM・最小バージョン", () => {
    const m = encode("HI");
    expect(m.ecLevel).toBe("M");
    expect(m.version).toBe(1);
  });

  it("不正バージョンは RangeError、容量超過は Error", () => {
    expect(() => encode("X", { version: 0 })).toThrow(RangeError);
    expect(() => encode("X", { version: 41 })).toThrow(RangeError);
    expect(() => encode("x".repeat(100), { version: 1 })).toThrow(/exceeds/);
  });

  it("不正な minVersion は RangeError(「収まらない」エラーにしない)", () => {
    expect(() => encode("X", { minVersion: 41 })).toThrow(RangeError);
    expect(() => encode("X", { minVersion: 0 })).toThrow(RangeError);
  });
});
