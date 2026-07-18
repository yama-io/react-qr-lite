import { describe, expect, it } from "vitest";
import { EC_LEVELS, getCapacity, totalCodewords, type ECLevel } from "./capacity";
import { buildCodewords } from "./codewords";
import {
  alignmentPositions,
  buildMatrix,
  formatBits,
  getModule,
  penaltyScore,
  versionBits,
  type QRMatrix,
} from "./matrix";
import { makeSegments } from "./segments";

/* ------------------------------------------------------------------ */
/* Format and version info                                              */
/* ------------------------------------------------------------------ */

/** Whether the GF(2) polynomial remainder is zero (for validating BCH codewords) */
function divisibleGF2(value: number, poly: number, polyDegree: number): boolean {
  for (let shift = 31 - polyDegree; shift >= 0; shift--) {
    if ((value >>> (shift + polyDegree)) & 1) {
      value ^= poly << shift;
    }
  }
  return value === 0;
}

describe("formatBits", () => {
  it("known vectors: (M,0) → 101010000010010, (M,2) → 101111001111100", () => {
    // (M, 0) has data 00000 with BCH remainder 0, so it equals the constant mask 0x5412 itself
    expect(formatBits("M", 0)).toBe(0b101010000010010);
    // (M, 2): data 00010 -> x^11 mod g(x) = 1001101110, then masked with 0x5412
    expect(formatBits("M", 2)).toBe(0b101111001111100);
  });

  it("removing the constant mask leaves all 32 words as BCH(15,5) codewords", () => {
    for (const level of EC_LEVELS) {
      for (let mask = 0; mask < 8; mask++) {
        const unmasked = formatBits(level, mask) ^ 0x5412;
        expect(divisibleGF2(unmasked, 0x537, 10), `${level}/${mask}`).toBe(true);
      }
    }
  });

  it("Hamming distance of all 32 codewords is at least 5 (error correction lower bound)", () => {
    const codes: number[] = [];
    for (const level of EC_LEVELS) {
      for (let mask = 0; mask < 8; mask++) codes.push(formatBits(level, mask));
    }
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        let d = 0;
        for (let x = codes[i]! ^ codes[j]!; x !== 0; x &= x - 1) d++;
        expect(d, `${i} vs ${j}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

describe("versionBits", () => {
  it("known vectors: v7 → 0x07C94, v8 → 0x085BC", () => {
    expect(versionBits(7)).toBe(0x07c94);
    expect(versionBits(8)).toBe(0x085bc);
  });

  it("for all of v7-40 the top 6 bits are the version and the whole is a BCH(18,6) codeword", () => {
    for (let v = 7; v <= 40; v++) {
      const bits = versionBits(v);
      expect(bits >> 12, `v${v}`).toBe(v);
      expect(divisibleGF2(bits, 0x1f25, 12), `v${v}`).toBe(true);
    }
  });
});

describe("alignmentPositions", () => {
  it.each([
    [1, []],
    [2, [6, 18]],
    [7, [6, 22, 38]],
    [14, [6, 26, 46, 66]],
    [22, [6, 26, 50, 74, 98]],
    [32, [6, 34, 60, 86, 112, 138]], // the even-split exception version
    [36, [6, 24, 50, 76, 102, 128, 154]],
    [40, [6, 30, 58, 86, 114, 142, 170]],
  ])("v%i center coordinates match the spec table", (version, expected) => {
    expect(alignmentPositions(version)).toEqual(expected);
  });

  it("structure is correct for every version (first 6, last size-7, equally spaced even steps between)", () => {
    for (let v = 2; v <= 40; v++) {
      const pos = alignmentPositions(v);
      const size = v * 4 + 17;
      expect(pos[0], `v${v}`).toBe(6);
      expect(pos[pos.length - 1], `v${v}`).toBe(size - 7);
      expect(pos.length, `v${v}`).toBe(Math.floor(v / 7) + 2);
      for (let i = 2; i < pos.length; i++) {
        const step = pos[i]! - pos[i - 1]!;
        expect(step % 2, `v${v} step`).toBe(0);
        if (i >= 3) expect(step, `v${v} equal step`).toBe(pos[i - 1]! - pos[i - 2]!);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Matrix structure                                                     */
/* ------------------------------------------------------------------ */

function buildFor(text: string, version: number, level: ECLevel, mask = -1): QRMatrix {
  return buildMatrix(
    buildCodewords(makeSegments(text), version, level),
    version,
    level,
    mask,
  );
}

describe("buildMatrix: structure", () => {
  const m = buildFor("STRUCTURE TEST", 2, "M");

  it("size is version*4+17", () => {
    expect(m.size).toBe(25);
    expect(m.modules.length).toBe(625);
  });

  it("finder patterns: centers, rings, and separators in three corners", () => {
    for (const [cx, cy] of [
      [3, 3],
      [m.size - 4, 3],
      [3, m.size - 4],
    ] as const) {
      expect(getModule(m, cx, cy)).toBe(1); // center
      expect(getModule(m, cx + 1, cy)).toBe(1); // 3x3 core
      expect(getModule(m, cx + 2, cy)).toBe(0); // inner light ring
      expect(getModule(m, cx + 3, cy)).toBe(1); // outer ring
      expect(getModule(m, cx, cy + 2)).toBe(0);
      expect(getModule(m, cx, cy + 3)).toBe(1);
    }
    // Separators (right of and below the top-left pattern)
    expect(getModule(m, 7, 0)).toBe(0);
    expect(getModule(m, 7, 7)).toBe(0);
    expect(getModule(m, 0, 7)).toBe(0);
  });

  it("timing patterns alternate", () => {
    for (let i = 8; i < m.size - 8; i++) {
      const expected = (i & 1) === 0 ? 1 : 0;
      expect(getModule(m, i, 6), `x=${i}`).toBe(expected);
      expect(getModule(m, 6, i), `y=${i}`).toBe(expected);
    }
  });

  it("dark module (8, size-8) is always dark", () => {
    for (const level of EC_LEVELS) {
      for (let mask = 0; mask < 8; mask++) {
        const mm = buildFor("DARK", 1, level, mask);
        expect(getModule(mm, 8, mm.size - 8)).toBe(1);
      }
    }
  });

  it("v2 alignment pattern (center 18,18) has the correct shape", () => {
    expect(getModule(m, 18, 18)).toBe(1); // center
    expect(getModule(m, 17, 18)).toBe(0); // light ring
    expect(getModule(m, 16, 18)).toBe(1); // outer ring
  });

  it("version info is placed in both locations for v7+", () => {
    const m7 = buildFor("VERSION INFO", 7, "L");
    const bits = versionBits(7);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >> i) & 1;
      const a = m7.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      expect(getModule(m7, a, b), `top-right bit${i}`).toBe(bit);
      expect(getModule(m7, b, a), `bottom-left bit${i}`).toBe(bit);
    }
  });

  it("format info reads back from the first copy (top-left L shape)", () => {
    for (let mask = 0; mask < 8; mask++) {
      const mm = buildFor("FMT", 1, "Q", mask);
      const expected = formatBits("Q", mask);
      let bits = 0;
      for (let i = 0; i <= 5; i++) bits |= getModule(mm, 8, i) << i;
      bits |= getModule(mm, 8, 7) << 6;
      bits |= getModule(mm, 8, 8) << 7;
      bits |= getModule(mm, 7, 8) << 8;
      for (let i = 9; i < 15; i++) bits |= getModule(mm, 14 - i, 8) << i;
      expect(bits, `mask ${mask}`).toBe(expected);
    }
  });

  it("placement invariants: every version × level builds without exceptions and remainder bits match the spec", () => {
    for (let v = 1; v <= 40; v++) {
      // Remainder bits: v1:0, v2-6:7, v7-13:0, v14-20:3, v21-27:4, v28-34:3, v35-40:0
      const expectedRemainder =
        v === 1 ? 0 : v <= 6 ? 7 : v <= 13 ? 0 : v <= 20 ? 3 : v <= 27 ? 4 : v <= 34 ? 3 : 0;
      for (const level of EC_LEVELS) {
        const mm = buildFor("R", v, level, 0);
        // Verify non-function modules = codewords x 8 + remainder bits
        // without rebuilding the function patterns: rely on buildMatrix not
        // throwing (placeData's internal check) plus an independent check of
        // the remainder-bit formula here
        const size = v * 4 + 17;
        let functionModules = 3 * 64 + 2 * (size - 16) + 31; // finders+separators, timing, format+dark
        if (v >= 2) {
          const n = Math.floor(v / 7) + 2;
          functionModules += (n * n - 3) * 25 - (n - 2) * 2 * 5; // alignment (adding back the overlap on timing)
        }
        if (v >= 7) functionModules += 36;
        const dataModules = size * size - functionModules;
        expect(dataModules - totalCodewords(v) * 8, `v${v}-${level}`).toBe(
          expectedRemainder,
        );
        expect(mm.size).toBe(size);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Penalty evaluation                                                   */
/* ------------------------------------------------------------------ */

/** A naive penalty reference implementation independent of the real one (string-based) */
function referencePenalty(m: QRMatrix): number {
  const { size } = m;
  const rows: string[] = [];
  const cols: string[] = [];
  for (let y = 0; y < size; y++) {
    let r = "";
    for (let x = 0; x < size; x++) r += getModule(m, x, y);
    rows.push(r);
  }
  for (let x = 0; x < size; x++) {
    let c = "";
    for (let y = 0; y < size; y++) c += getModule(m, x, y);
    cols.push(c);
  }
  let n1 = 0;
  for (const line of [...rows, ...cols]) {
    for (const run of line.match(/0+|1+/g)!) {
      if (run.length >= 5) n1 += 3 + (run.length - 5);
    }
  }
  let n2 = 0;
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const a = getModule(m, x, y);
      if (
        a === getModule(m, x + 1, y) &&
        a === getModule(m, x, y + 1) &&
        a === getModule(m, x + 1, y + 1)
      ) {
        n2 += 3;
      }
    }
  }
  let n3 = 0;
  for (const line of [...rows, ...cols]) {
    for (const pat of ["10111010000", "00001011101"]) {
      for (let i = line.indexOf(pat); i !== -1; i = line.indexOf(pat, i + 1)) n3 += 40;
    }
  }
  let dark = 0;
  for (const b of m.modules) dark += b;
  const n4 = Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
  return n1 + n2 + n3 + n4;
}

function makeMatrix(size: number, fill: (x: number, y: number) => number): QRMatrix {
  const modules = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) modules[y * size + x] = fill(x, y);
  }
  return { size, version: 1, ecLevel: "M", mask: 0, modules };
}

describe("penaltyScore", () => {
  it("all-dark 5×5 = 178 (hand-computed N1:30, N2:48, N3:0, N4:100)", () => {
    expect(penaltyScore(makeMatrix(5, () => 1))).toBe(178);
  });

  it("checkerboard scores 0 on N1/N2/N3, leaving only N4", () => {
    const size = 21;
    const m = makeMatrix(size, (x, y) => (x + y) & 1);
    // 220 dark of 21x21=441 modules -> 49.88% -> N4=0
    expect(penaltyScore(m)).toBe(0);
  });

  it("N3: detects 4 light modules around 1011101 (row direction)", () => {
    // Put 00001011101 in one row; the rest is a checkerboard scoring zero
    const size = 21;
    const m = makeMatrix(size, (x, y) => (x + y) & 1);
    const pattern = "00001011101";
    for (let x = 0; x < pattern.length; x++) {
      m.modules[10 * size + x] = pattern.charCodeAt(x) - 48;
    }
    expect(penaltyScore(m)).toBe(referencePenalty(m));
    expect(penaltyScore(m)).toBeGreaterThanOrEqual(40);
  });

  it("matches the reference implementation exactly on encoded matrices × all 8 masks", () => {
    const cases: [string, number, ECLevel][] = [
      ["0123456789", 1, "M"],
      ["PENALTY REFERENCE CHECK", 3, "Q"],
      ["https://example.com/some/path", 4, "H"],
      ["x".repeat(120), 7, "L"],
    ];
    for (const [text, version, level] of cases) {
      for (let mask = 0; mask < 8; mask++) {
        const m = buildFor(text, version, level, mask);
        expect(penaltyScore(m), `${text.slice(0, 10)} mask${mask}`).toBe(
          referencePenalty(m),
        );
      }
    }
  });
});

describe("automatic mask selection", () => {
  it("the chosen mask has the lowest penalty of the 8 candidates", () => {
    for (const text of ["AUTO MASK", "1234567890123", "https://example.com/q?a=1"]) {
      const auto = buildFor(text, 3, "M");
      const scores = Array.from({ length: 8 }, (_, mask) =>
        penaltyScore(buildFor(text, 3, "M", mask)),
      );
      expect(penaltyScore(auto)).toBe(Math.min(...scores));
      expect(auto.mask).toBe(scores.indexOf(Math.min(...scores)));
    }
  });

  it("a pinned mask is used as-is", () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(buildFor("FIX", 1, "M", mask).mask).toBe(mask);
    }
  });

  it("invalid mask numbers are RangeError", () => {
    const cw = buildCodewords(makeSegments("X"), 1, "M");
    expect(() => buildMatrix(cw, 1, "M", 8)).toThrow(RangeError);
    expect(() => buildMatrix(cw, 1, "M", -2)).toThrow(RangeError);
  });

  it("mismatched codeword counts are RangeError", () => {
    expect(() => buildMatrix(new Uint8Array(25), 1, "M")).toThrow(RangeError);
  });
});

describe("mask application consistency", () => {
  it("different masks change the data region but keep the function patterns identical", () => {
    const a = buildFor("MASK DIFF", 2, "M", 0);
    const b = buildFor("MASK DIFF", 2, "M", 1);
    // Timing and finder patterns are unchanged
    for (let i = 8; i < a.size - 8; i++) {
      expect(getModule(a, i, 6)).toBe(getModule(b, i, 6));
    }
    // But the matrices differ overall
    let differs = false;
    for (let i = 0; i < a.modules.length; i++) {
      if (a.modules[i] !== b.modules[i]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
  });
});
