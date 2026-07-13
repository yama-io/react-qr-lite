import { describe, expect, it } from "vitest";
import {
  add,
  div,
  exp,
  inv,
  log,
  mul,
  polyMul,
  pow,
  rsGeneratorPoly,
} from "./gf256";

/**
 * Reference implementation: table-free bitwise multiplication (Russian
 * peasant method). Used to catch table-generation bugs in the real
 * implementation through an independent path.
 */
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

describe("gf256: 基本値", () => {
  it("α^0..α^8 が既知の値と一致する", () => {
    // The well-known sequence for α = 2 with primitive polynomial 0x11D
    const expected = [1, 2, 4, 8, 16, 32, 64, 128, 29];
    expected.forEach((v, i) => expect(exp(i)).toBe(v));
  });

  it("α^255 = α^0 = 1 (周期255)", () => {
    expect(exp(255)).toBe(1);
    expect(exp(510)).toBe(1);
  });

  it("log は exp の逆関数", () => {
    for (let i = 0; i < 255; i++) {
      expect(log(exp(i))).toBe(i);
    }
    for (let a = 1; a <= 255; a++) {
      expect(exp(log(a))).toBe(a);
    }
  });
});

describe("gf256: 参照実装との全数一致", () => {
  it("mul が全65536ペアで参照実装と一致する", () => {
    for (let a = 0; a <= 255; a++) {
      for (let b = 0; b <= 255; b++) {
        expect(mul(a, b)).toBe(referenceMul(a, b));
      }
    }
  });
});

describe("gf256: 体の公理", () => {
  it("乗算の単位元は1、零元は0", () => {
    for (let a = 0; a <= 255; a++) {
      expect(mul(a, 1)).toBe(a);
      expect(mul(1, a)).toBe(a);
      expect(mul(a, 0)).toBe(0);
      expect(mul(0, a)).toBe(0);
    }
  });

  it("乗算は可換", () => {
    for (let a = 0; a <= 255; a += 7) {
      for (let b = 0; b <= 255; b++) {
        expect(mul(a, b)).toBe(mul(b, a));
      }
    }
  });

  it("分配法則: a·(b+c) = a·b + a·c (加算はXOR)", () => {
    for (let a = 1; a <= 255; a += 5) {
      for (let b = 0; b <= 255; b += 3) {
        for (let c = 0; c <= 255; c += 11) {
          expect(mul(a, add(b, c))).toBe(add(mul(a, b), mul(a, c)));
        }
      }
    }
  });

  it("すべての非零元が逆元を持つ: a · a⁻¹ = 1", () => {
    for (let a = 1; a <= 255; a++) {
      expect(mul(a, inv(a))).toBe(1);
    }
  });

  it("除算は乗算の逆演算: (a·b) / b = a", () => {
    for (let a = 0; a <= 255; a += 3) {
      for (let b = 1; b <= 255; b += 5) {
        expect(div(mul(a, b), b)).toBe(a);
      }
    }
  });

  it("pow は mul の反復と一致する", () => {
    for (let a = 1; a <= 255; a += 17) {
      let acc = 1;
      for (let n = 0; n <= 20; n++) {
        expect(pow(a, n)).toBe(acc);
        acc = mul(acc, a);
      }
    }
    expect(pow(0, 0)).toBe(1);
    expect(pow(0, 5)).toBe(0);
  });
});

describe("gf256: エラー処理", () => {
  it("log(0) は RangeError", () => {
    expect(() => log(0)).toThrow(RangeError);
  });

  it("ゼロ除算は RangeError", () => {
    expect(() => div(1, 0)).toThrow(RangeError);
  });

  it("inv(0) は RangeError", () => {
    expect(() => inv(0)).toThrow(RangeError);
  });
});

describe("gf256: 多項式演算", () => {
  it("polyMul: (x + 1)(x + 2) = x^2 + 3x + 2", () => {
    // In GF(256): 1+2 = 1^2 = 3, and 1·2 = 2
    const p = polyMul(new Uint8Array([1, 1]), new Uint8Array([1, 2]));
    expect(Array.from(p)).toEqual([1, 3, 2]);
  });

  it("polyMul: 単位多項式 [1] は恒等", () => {
    const p = new Uint8Array([7, 42, 99]);
    expect(Array.from(polyMul(p, new Uint8Array([1])))).toEqual([7, 42, 99]);
  });

  it("rsGeneratorPoly(1) = x + 1", () => {
    expect(Array.from(rsGeneratorPoly(1))).toEqual([1, 1]);
  });

  it("rsGeneratorPoly(7) が既知の係数と一致する(QR仕様の生成多項式)", () => {
    // g(x) = x^7 + α^87·x^6 + α^229·x^5 + α^146·x^4 + α^149·x^3
    //        + α^238·x^2 + α^102·x + α^21
    // (widely published as the table accompanying ISO/IEC 18004)
    const g = rsGeneratorPoly(7);
    const expected = [0, 87, 229, 146, 149, 238, 102, 21].map((e, i) =>
      i === 0 ? 1 : exp(e),
    );
    expect(Array.from(g)).toEqual(expected);
  });

  it("rsGeneratorPoly(10) が既知の係数と一致する", () => {
    // In exponent form: [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45]
    const g = rsGeneratorPoly(10);
    const expectedExponents = [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45];
    expect(Array.from(g)).toEqual(expectedExponents.map((e) => exp(e)));
  });

  it("rsGeneratorPoly の根は α^0..α^(degree-1)", () => {
    // Verify by evaluation that g(α^i) = 0 for i < degree
    for (const degree of [7, 10, 13, 30]) {
      const g = rsGeneratorPoly(degree);
      for (let i = 0; i < degree; i++) {
        const x = exp(i);
        // Evaluate the polynomial via Horner's method
        let acc = 0;
        for (const coef of g) {
          acc = mul(acc, x) ^ coef;
        }
        expect(acc).toBe(0);
      }
    }
  });
});
