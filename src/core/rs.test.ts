import { describe, expect, it } from "vitest";
import { exp, mul } from "./gf256";
import { rsEncode } from "./rs";

/* ------------------------------------------------------------------ */
/* Reference implementations (independent of the real code): table-free    */
/* bitwise multiplication and naive polynomial long division, to catch      */
/* table-generation or synthetic-division bugs through a separate path.    */
/* ------------------------------------------------------------------ */

function referenceMul(a: number, b: number): number {
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    b >>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
  }
  return result;
}

/** Generator polynomial via the reference implementation (built with referenceMul only) */
function referenceGeneratorPoly(degree: number): number[] {
  let g = [1];
  let alpha = 1; // α^0
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] = next[j]! ^ g[j]!; // x * g(x)
      next[j + 1] = next[j + 1]! ^ referenceMul(g[j]!, alpha); // α^i * g(x)
    }
    g = next;
    alpha = referenceMul(alpha, 2); // α^(i+1)
  }
  return g;
}

/** Remainder via the reference implementation (naive long division) */
function referenceRemainder(data: Uint8Array, degree: number): number[] {
  const gen = referenceGeneratorPoly(degree);
  const msg = new Array<number>(data.length + degree).fill(0);
  for (let i = 0; i < data.length; i++) msg[i] = data[i]!;

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i]!;
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      msg[i + j]! ^= referenceMul(gen[j]!, coef);
    }
  }
  return msg.slice(data.length);
}

/** Deterministic pseudo-random numbers (for test reproducibility) */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s >>> 24; // 0..255
  };
}

/* ------------------------------------------------------------------ */

describe("rsEncode: 手計算で検証できるケース", () => {
  it("degree 1 の剰余は全データバイトのXOR(g(x) = x + 1, 剰余 = d(1))", () => {
    const data = new Uint8Array([0x12, 0x34, 0x56, 0xff, 0x01]);
    const xorAll = 0x12 ^ 0x34 ^ 0x56 ^ 0xff ^ 0x01;
    expect(Array.from(rsEncode(data, 1))).toEqual([xorAll]);
  });

  it("空データの剰余はゼロ", () => {
    expect(Array.from(rsEncode(new Uint8Array(0), 10))).toEqual(
      new Array(10).fill(0),
    );
  });

  it("ゼロのみのデータの剰余はゼロ", () => {
    expect(Array.from(rsEncode(new Uint8Array(16), 10))).toEqual(
      new Array(10).fill(0),
    );
  });
});

describe("rsEncode: 参照実装との一致", () => {
  it("QRで実際に使う次数(7,10,13,15,16,17,18,20,22,24,26,28,30)でランダムデータが一致する", () => {
    const degrees = [7, 10, 13, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30];
    const rng = makeRng(0xc0ffee);
    for (const degree of degrees) {
      for (const dataLen of [1, 9, 19, 55, 123]) {
        const data = new Uint8Array(dataLen);
        for (let i = 0; i < dataLen; i++) data[i] = rng();
        expect(Array.from(rsEncode(data, degree)), 
          `degree=${degree}, dataLen=${dataLen}`,
        ).toEqual(referenceRemainder(data, degree));
      }
    }
  });
});

describe("rsEncode: Reed-Solomon符号の性質", () => {
  it("送信多項式 d(x)·x^k + r(x) は α^0..α^(k-1) を根に持つ", () => {
    const rng = makeRng(0xdeadbeef);
    for (const degree of [7, 10, 30]) {
      const data = new Uint8Array(40);
      for (let i = 0; i < data.length; i++) data[i] = rng();

      const ec = rsEncode(data, degree);
      const codeword = new Uint8Array(data.length + degree);
      codeword.set(data);
      codeword.set(ec, data.length);

      for (let i = 0; i < degree; i++) {
        const x = exp(i);
        // Evaluate codeword(x) via Horner's method
        let acc = 0;
        for (const coef of codeword) {
          acc = mul(acc, x) ^ coef;
        }
        expect(acc, `degree=${degree}, root=α^${i}`).toBe(0);
      }
    }
  });

  it("結果は常に ecLength バイト", () => {
    for (const degree of [1, 7, 30, 68]) {
      expect(rsEncode(new Uint8Array([1, 2, 3]), degree).length).toBe(degree);
    }
  });
});

describe("rsEncode: エラー処理", () => {
  it("ecLength が 0 以下や非整数なら RangeError", () => {
    const data = new Uint8Array([1]);
    expect(() => rsEncode(data, 0)).toThrow(RangeError);
    expect(() => rsEncode(data, -1)).toThrow(RangeError);
    expect(() => rsEncode(data, 2.5)).toThrow(RangeError);
  });
});
