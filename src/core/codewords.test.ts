import { describe, expect, it } from "vitest";
import { getCapacity } from "./capacity";
import {
  assembleCodewords,
  buildCodewords,
  buildDataCodewords,
  chooseVersion,
} from "./codewords";
import { rsEncode } from "./rs";
import { makeByteSegment, makeSegments } from "./segments";

describe("chooseVersion: capacity boundaries (known maximum character counts)", () => {
  it("byte mode: 17 chars fit v1-L, 18 need v2", () => {
    expect(chooseVersion(makeSegments("x".repeat(17)), "L")).toBe(1);
    expect(chooseVersion(makeSegments("x".repeat(18)), "L")).toBe(2);
  });

  it("numeric mode: 41 digits fit v1-L, 42 need v2", () => {
    expect(chooseVersion(makeSegments("1".repeat(41)), "L")).toBe(1);
    expect(chooseVersion(makeSegments("1".repeat(42)), "L")).toBe(2);
  });

  it("alphanumeric mode: 25 chars fit v1-L, 26 need v2", () => {
    expect(chooseVersion(makeSegments("A".repeat(25)), "L")).toBe(1);
    expect(chooseVersion(makeSegments("A".repeat(26)), "L")).toBe(2);
  });

  it("numeric 7089 digits exactly fit v40-L and 7090 do not (the spec maximum)", () => {
    expect(chooseVersion(makeSegments("1".repeat(7089)), "L")).toBe(40);
    expect(() => chooseVersion(makeSegments("1".repeat(7090)), "L")).toThrow(
      /too long/,
    );
  });

  it("byte 2953 bytes is the v40-L maximum", () => {
    expect(chooseVersion(makeSegments("x".repeat(2953)), "L")).toBe(40);
    expect(() => chooseVersion(makeSegments("x".repeat(2954)), "L")).toThrow();
  });

  it("alphanumeric 4296 chars is the v40-L maximum", () => {
    expect(chooseVersion(makeSegments("A".repeat(4296)), "L")).toBe(40);
    expect(() => chooseVersion(makeSegments("A".repeat(4297)), "L")).toThrow();
  });

  it("kanji mode: 10 chars fit v1-L, 11 need v2 / 1817 is the v40-L maximum", () => {
    expect(chooseVersion(makeSegments("字".repeat(10)), "L")).toBe(1);
    expect(chooseVersion(makeSegments("字".repeat(11)), "L")).toBe(2);
    expect(chooseVersion(makeSegments("字".repeat(1817)), "L")).toBe(40);
    expect(() => chooseVersion(makeSegments("字".repeat(1818)), "L")).toThrow();
  });

  it("searches from minVersion upward", () => {
    expect(chooseVersion(makeSegments("HI"), "L", 5)).toBe(5);
  });

  it("invalid minVersion (0, 41, non-integer) is RangeError", () => {
    const segs = makeSegments("HI");
    expect(() => chooseVersion(segs, "L", 0)).toThrow(RangeError);
    expect(() => chooseVersion(segs, "L", 41)).toThrow(RangeError);
    expect(() => chooseVersion(segs, "L", 2.5)).toThrow(RangeError);
  });

  it("higher levels can require a larger version for the same data", () => {
    const segs = makeSegments("x".repeat(17));
    expect(chooseVersion(segs, "L")).toBe(1);
    expect(chooseVersion(segs, "H")).toBe(3); // 1-H=7B, 2-H=14B, 3-H=26B
  });
});

describe("buildDataCodewords: ISO/IEC 18004 worked example", () => {
  it('"01234567" at 1-M matches the spec example data codewords', () => {
    const cap = getCapacity(1, "M");
    const data = buildDataCodewords(makeSegments("01234567"), cap);
    // The spec's worked example: after terminator + bit padding, pads 0xEC/0x11 alternate
    expect(Array.from(data)).toEqual([
      0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
      0xec, 0x11, 0xec, 0x11,
    ]);
  });

  it("data at exact capacity gets no pad codewords", () => {
    // 1-L: 19 bytes = 152 bits. Byte, 17 chars -> 4+8+136 = 148 bits + 4-bit terminator = 152 bits
    const cap = getCapacity(1, "L");
    const data = buildDataCodewords(makeSegments("x".repeat(17)), cap);
    expect(data.length).toBe(19);
    // Final byte: 4-bit terminator, no padding -> low 4 bits of 'x' (0x78) + 0000
    expect(data[18]).toBe(0x80); // After the last char: ...1000 0000 (length consistency is the main point here)
  });

  it("exceeding capacity throws", () => {
    const cap = getCapacity(1, "H"); // 9 bytes
    expect(() =>
      buildDataCodewords([makeByteSegment("x".repeat(10))], cap),
    ).toThrow(/exceeds capacity/);
  });
});

describe("assembleCodewords: block splitting and interleaving", () => {
  it("a single block (1-M) is a plain concatenation of data + EC", () => {
    const cap = getCapacity(1, "M");
    const data = new Uint8Array(16).map((_, i) => i + 1);
    const out = assembleCodewords(data, cap);
    expect(out.length).toBe(26);
    expect(Array.from(out.subarray(0, 16))).toEqual(Array.from(data));
    expect(Array.from(out.subarray(16))).toEqual(
      Array.from(rsEncode(data, 10)),
    );
  });

  it("5-Q interleave order (4 blocks of 15,15,16,16 bytes) matches the spec", () => {
    const cap = getCapacity(5, "Q");
    // Sequential data makes block boundaries and interleave order traceable
    const data = new Uint8Array(62).map((_, i) => i);
    const out = assembleCodewords(data, cap);

    // Blocks: B0=[0..14] B1=[15..29] B2=[30..45] B3=[46..61]
    const blocks = [
      data.subarray(0, 15),
      data.subarray(15, 30),
      data.subarray(30, 46),
      data.subarray(46, 62),
    ];
    // Expected data part: B0,B1,B2,B3 per column; column 15 has long blocks only
    const expectedData: number[] = [];
    for (let col = 0; col < 16; col++) {
      for (const b of blocks) {
        if (col < b.length) expectedData.push(b[col]!);
      }
    }
    expect(Array.from(out.subarray(0, 62))).toEqual(expectedData);
    // The last two bytes are the final data bytes of the long blocks (B2, B3)
    expect(expectedData[60]).toBe(45);
    expect(expectedData[61]).toBe(61);

    // Expected EC part: each block's EC interleaved column by column
    const ecs = blocks.map((b) => rsEncode(b, 18));
    const expectedEc: number[] = [];
    for (let col = 0; col < 18; col++) {
      for (const ec of ecs) expectedEc.push(ec[col]!);
    }
    expect(Array.from(out.subarray(62))).toEqual(expectedEc);
  });

  it("mismatched data lengths are RangeError", () => {
    const cap = getCapacity(5, "Q");
    expect(() => assembleCodewords(new Uint8Array(61), cap)).toThrow(
      RangeError,
    );
  });
});

describe("buildCodewords: end to end", () => {
  it("output length always equals the total codeword count (all levels × representative versions)", () => {
    for (const version of [1, 2, 5, 7, 10, 20, 40] as const) {
      for (const level of ["L", "M", "Q", "H"] as const) {
        const cap = getCapacity(version, level);
        // Data at roughly half capacity
        const text = "x".repeat(Math.max(1, Math.floor(cap.dataCodewords / 2)));
        const out = buildCodewords(makeSegments(text), version, level);
        expect(out.length, `v${version}-${level}`).toBe(cap.totalCodewords);
      }
    }
  });

  it('complete codeword sequence of the ISO example "01234567" at 1-M (16 data + 10 EC)', () => {
    const out = buildCodewords(makeSegments("01234567"), 1, "M");
    const expectedData = [
      0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11,
      0xec, 0x11, 0xec, 0x11,
    ];
    expect(out.length).toBe(26);
    expect(Array.from(out.subarray(0, 16))).toEqual(expectedData);
    expect(Array.from(out.subarray(16))).toEqual(
      Array.from(rsEncode(new Uint8Array(expectedData), 10)),
    );
  });
});
