import { describe, expect, it } from "vitest";
import { BitBuffer } from "./bitbuffer";
import {
  ccBits,
  makeKanjiSegment,
  detectMode,
  makeAlphanumericSegment,
  makeByteSegment,
  makeNumericSegment,
  makeSegments,
  segmentBits,
  writeSegment,
  type Segment,
} from "./segments";

/** Writes a segment at the given version and returns it as a "0101..." bit string */
function toBitString(seg: Segment, version: number): string {
  const buf = new BitBuffer();
  writeSegment(buf, seg, version);
  let s = "";
  for (let i = 0; i < buf.length; i++) s += buf.getBit(i);
  return s;
}

const bin = (value: number, width: number) =>
  value.toString(2).padStart(width, "0");

describe("detectMode", () => {
  it("digits only → numeric", () => {
    expect(detectMode("0123456789")).toBe("numeric");
    expect(detectMode("0")).toBe("numeric");
  });

  it("within the alphanumeric charset → alphanumeric", () => {
    expect(detectMode("HELLO WORLD")).toBe("alphanumeric");
    expect(detectMode("AC-42")).toBe("alphanumeric");
    expect(detectMode("A1 $%*+-./:")).toBe("alphanumeric");
  });

  it("lowercase, symbols, non-ASCII → byte", () => {
    expect(detectMode("hello")).toBe("byte");
    expect(detectMode("HTTPS://例")).toBe("byte");
    expect(detectMode("A_B")).toBe("byte");
    expect(detectMode("ABC,")).toBe("byte");
  });

  it("empty string → numeric (the smallest representation)", () => {
    expect(detectMode("")).toBe("numeric");
  });
});

describe("ccBits: character count indicator widths", () => {
  it("widths per version band match the spec", () => {
    expect(ccBits("numeric", 1)).toBe(10);
    expect(ccBits("numeric", 9)).toBe(10);
    expect(ccBits("numeric", 10)).toBe(12);
    expect(ccBits("numeric", 26)).toBe(12);
    expect(ccBits("numeric", 27)).toBe(14);
    expect(ccBits("alphanumeric", 1)).toBe(9);
    expect(ccBits("alphanumeric", 15)).toBe(11);
    expect(ccBits("alphanumeric", 40)).toBe(13);
    expect(ccBits("byte", 9)).toBe(8);
    expect(ccBits("byte", 10)).toBe(16);
    expect(ccBits("byte", 40)).toBe(16);
  });
});

describe("makeNumericSegment", () => {
  it('matches the ISO/IEC 18004 worked example "01234567"', () => {
    // 012 → 12, 345 → 345, 67 → 67
    const expected =
      bin(0b0001, 4) + // mode indicator
      bin(8, 10) + // count indicator (10 bits for v1-9)
      bin(12, 10) +
      bin(345, 10) +
      bin(67, 7);
    const seg = makeNumericSegment("01234567");
    expect(toBitString(seg, 1)).toBe(expected);
    expect(seg.dataBits).toBe(27);
    expect(segmentBits(seg, 1)).toBe(41);
  });

  it("a 1-digit remainder takes 4 bits", () => {
    const seg = makeNumericSegment("1234");
    // 123 → 10bit, 4 → 4bit
    expect(seg.dataBits).toBe(14);
    expect(toBitString(seg, 1)).toBe(
      bin(1, 4) + bin(4, 10) + bin(123, 10) + bin(4, 4),
    );
  });

  it("throws on non-digit characters", () => {
    expect(() => makeNumericSegment("12a")).toThrow(/non-digit/);
  });
});

describe("makeAlphanumericSegment", () => {
  it('"AC-42" encodes to the known pair values (462, 1849)', () => {
    // A=10, C=12 → 10·45+12 = 462 / -=41, 4=4 → 41·45+4 = 1849 / 2 → 2
    const expected =
      bin(0b0010, 4) +
      bin(5, 9) + // 9 bits for v1-9
      bin(462, 11) +
      bin(1849, 11) +
      bin(2, 6);
    const seg = makeAlphanumericSegment("AC-42");
    expect(toBitString(seg, 1)).toBe(expected);
    expect(seg.dataBits).toBe(28);
  });

  it("throws on characters outside the charset (lowercase)", () => {
    expect(() => makeAlphanumericSegment("Ab")).toThrow(/invalid character/);
  });
});

describe("makeByteSegment", () => {
  it("ASCII strings are one byte per character", () => {
    const seg = makeByteSegment("abc");
    expect(seg.numChars).toBe(3);
    expect(seg.dataBits).toBe(24);
    expect(toBitString(seg, 1)).toBe(
      bin(0b0100, 4) + bin(3, 8) + bin(0x61, 8) + bin(0x62, 8) + bin(0x63, 8),
    );
  });

  it("count indicator holds the UTF-8 byte count (3 bytes per Japanese character)", () => {
    const seg = makeByteSegment("あ"); // U+3042 → E3 81 82
    expect(seg.numChars).toBe(3);
    expect(toBitString(seg, 1)).toBe(
      bin(0b0100, 4) + bin(3, 8) + bin(0xe3, 8) + bin(0x81, 8) + bin(0x82, 8),
    );
  });

  it("accepts a Uint8Array as-is", () => {
    const seg = makeByteSegment(new Uint8Array([0xff, 0x00]));
    expect(seg.numChars).toBe(2);
  });
});

describe("makeSegments: automatic mode selection", () => {
  it.each([
    ["0123456789", "numeric"],
    ["HELLO WORLD", "alphanumeric"],
    ["https://example.com", "byte"],
  ] as const)("%s → %s", (text, mode) => {
    const segs = makeSegments(text);
    expect(segs).toHaveLength(1);
    expect(segs[0]!.mode).toBe(mode);
  });
});

describe("writeSegment / segmentBits: count indicator limits", () => {
  it("256 bytes do not fit the 8-bit byte-mode indicator of v1-9", () => {
    const seg = makeByteSegment(new Uint8Array(256));
    expect(segmentBits(seg, 9)).toBe(Infinity);
    expect(() => toBitString(seg, 9)).toThrow(RangeError);
    // Writable from v10 on (16 bits)
    expect(segmentBits(seg, 10)).toBe(4 + 16 + 2048);
  });
});

describe("makeKanjiSegment", () => {
  it('matches the ISO/IEC 18004 worked example "点茗"', () => {
    // 0x935F -> -0x8140 = 0x121F -> 0x12*0xC0+0x1F = 0x0D9F
    // 0xE4AA -> -0xC140 = 0x236A -> 0x23*0xC0+0x6A = 0x1AAA
    const expected =
      bin(0b1000, 4) + // mode indicator
      bin(2, 8) + // count indicator (8 bits for v1-9)
      bin(0x0d9f, 13) +
      bin(0x1aaa, 13);
    const seg = makeKanjiSegment("点茗");
    expect(toBitString(seg, 1)).toBe(expected);
    expect(seg.dataBits).toBe(26);
    expect(seg.numChars).toBe(2);
  });

  it("throws on characters not representable in kanji mode", () => {
    expect(() => makeKanjiSegment("あA")).toThrow(/not encodable/);
    expect(() => makeKanjiSegment("ｱ")).toThrow(/not encodable/); // half-width katakana
  });

  it("shorter than byte mode for the same Japanese string (13 vs 24 bits per char)", () => {
    const text = "こんにちは世界";
    const kanji = makeKanjiSegment(text);
    const byte = makeByteSegment(text);
    expect(kanji.dataBits).toBe(7 * 13);
    expect(byte.dataBits).toBe(21 * 8);
    expect(kanji.dataBits).toBeLessThan(byte.dataBits);
  });
});

describe("detectMode: Kanji", () => {
  it("all-double-byte strings → kanji", () => {
    expect(detectMode("こんにちは")).toBe("kanji");
    expect(detectMode("漢字、カタカナ。全角Ａも")).toBe("kanji");
  });

  it("mixed ASCII, emoji, half-width kana → byte", () => {
    expect(detectMode("こんにちはA")).toBe("byte");
    expect(detectMode("こんにちは123")).toBe("byte");
    expect(detectMode("絵文字🎌入り")).toBe("byte");
    expect(detectMode("ﾊﾝｶｸｶﾅ")).toBe("byte");
  });

  it("allowKanji: false skips kanji detection and yields byte (other modes unchanged)", () => {
    expect(detectMode("こんにちは", { allowKanji: false })).toBe("byte");
    expect(detectMode("0123", { allowKanji: false })).toBe("numeric");
    expect(detectMode("HELLO", { allowKanji: false })).toBe("alphanumeric");
  });

  it("makeSegments also respects allowKanji", () => {
    expect(makeSegments("漢字")[0]!.mode).toBe("kanji");
    expect(makeSegments("漢字", { allowKanji: false })[0]!.mode).toBe("byte");
  });
});

describe("ccBits: kanji-mode character count indicator", () => {
  it("widths per version band match the spec", () => {
    expect(ccBits("kanji", 1)).toBe(8);
    expect(ccBits("kanji", 9)).toBe(8);
    expect(ccBits("kanji", 10)).toBe(10);
    expect(ccBits("kanji", 26)).toBe(10);
    expect(ccBits("kanji", 27)).toBe(12);
  });
});
