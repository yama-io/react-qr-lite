import { describe, expect, it } from "vitest";
import {
  EC_LEVELS,
  getCapacity,
  totalCodewords,
  type ECLevel,
} from "./capacity";

describe("totalCodewords: 既知の総コードワード数", () => {
  it.each([
    [1, 26],
    [2, 44],
    [3, 70],
    [4, 100],
    [5, 134],
    [7, 196],
    [10, 346],
    [14, 581],
    [25, 1588],
    [40, 3706],
  ])("バージョン %i → %i", (version, expected) => {
    expect(totalCodewords(version)).toBe(expected);
  });

  it("バージョンが増えると単調増加する", () => {
    for (let v = 2; v <= 40; v++) {
      expect(totalCodewords(v)).toBeGreaterThan(totalCodewords(v - 1));
    }
  });

  it("範囲外のバージョンは RangeError", () => {
    expect(() => totalCodewords(0)).toThrow(RangeError);
    expect(() => totalCodewords(41)).toThrow(RangeError);
    expect(() => totalCodewords(1.5)).toThrow(RangeError);
  });
});

describe("getCapacity: 既知のデータコードワード数(ISO表9のスポットチェック)", () => {
  it.each([
    // [version, level, dataCodewords]
    [1, "L", 19],
    [1, "M", 16],
    [1, "Q", 13],
    [1, "H", 9],
    [2, "L", 34],
    [2, "H", 16],
    [3, "Q", 34],
    [3, "H", 26],
    [4, "H", 36],
    [5, "Q", 62],
    [7, "L", 156],
    [10, "L", 274],
    [10, "H", 122],
    [13, "H", 180],
    [14, "Q", 261],
    [40, "L", 2956],
    [40, "H", 1276],
  ] as [number, ECLevel, number][])(
    "バージョン %i-%s → データ %i コードワード",
    (version, level, expected) => {
      expect(getCapacity(version, level).dataCodewords).toBe(expected);
    },
  );

  it("5-Qのブロック構造: 15バイト×2 + 16バイト×2, EC18(既知値)", () => {
    const cap = getCapacity(5, "Q");
    expect(cap.numBlocks).toBe(4);
    expect(cap.ecPerBlock).toBe(18);
    expect(cap.numShortBlocks).toBe(2);
    expect(cap.shortBlockDataLen).toBe(15);
  });
});

describe("getCapacity: 全バージョン×全レベルの構造的な整合性", () => {
  it("ブロック分割の合計が常にデータ/総コードワード数と一致する", () => {
    for (let v = 1; v <= 40; v++) {
      for (const level of EC_LEVELS) {
        const cap = getCapacity(v, level);
        const numLongBlocks = cap.numBlocks - cap.numShortBlocks;
        const dataSum =
          cap.numShortBlocks * cap.shortBlockDataLen +
          numLongBlocks * (cap.shortBlockDataLen + 1);
        expect(dataSum, `v${v}-${level} data`).toBe(cap.dataCodewords);
        expect(
          cap.dataCodewords + cap.ecPerBlock * cap.numBlocks,
          `v${v}-${level} total`,
        ).toBe(cap.totalCodewords);
        // Every block holds at least one data byte, so EC capability is meaningful
        expect(cap.shortBlockDataLen, `v${v}-${level} short`).toBeGreaterThan(0);
        expect(cap.numShortBlocks).toBeGreaterThanOrEqual(0);
        expect(cap.numShortBlocks).toBeLessThanOrEqual(cap.numBlocks);
      }
    }
  });

  it("同一バージョンではレベルが上がるほどデータ容量が減る(L>M>Q>H)", () => {
    for (let v = 1; v <= 40; v++) {
      const [l, m, q, h] = EC_LEVELS.map(
        (lv) => getCapacity(v, lv).dataCodewords,
      );
      expect(l, `v${v}`).toBeGreaterThan(m!);
      expect(m, `v${v}`).toBeGreaterThan(q!);
      expect(q, `v${v}`).toBeGreaterThan(h!);
    }
  });

  it("不正な誤り訂正レベルは RangeError", () => {
    expect(() => getCapacity(1, "X" as ECLevel)).toThrow(RangeError);
  });
});
