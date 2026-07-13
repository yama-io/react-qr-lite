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
  it("数字のみ → numeric", () => {
    expect(detectMode("0123456789")).toBe("numeric");
    expect(detectMode("0")).toBe("numeric");
  });

  it("英数字集合内 → alphanumeric", () => {
    expect(detectMode("HELLO WORLD")).toBe("alphanumeric");
    expect(detectMode("AC-42")).toBe("alphanumeric");
    expect(detectMode("A1 $%*+-./:")).toBe("alphanumeric");
  });

  it("小文字・記号・非ASCII → byte", () => {
    expect(detectMode("hello")).toBe("byte");
    expect(detectMode("HTTPS://例")).toBe("byte");
    expect(detectMode("A_B")).toBe("byte");
    expect(detectMode("ABC,")).toBe("byte");
  });

  it("空文字列 → numeric(最小の表現)", () => {
    expect(detectMode("")).toBe("numeric");
  });
});

describe("ccBits: 文字数指示子の幅", () => {
  it("バージョン帯ごとの幅が仕様どおり", () => {
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
  it('ISO/IEC 18004の符号化例 "01234567" と一致する', () => {
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

  it("余り1桁は4bit", () => {
    const seg = makeNumericSegment("1234");
    // 123 → 10bit, 4 → 4bit
    expect(seg.dataBits).toBe(14);
    expect(toBitString(seg, 1)).toBe(
      bin(1, 4) + bin(4, 10) + bin(123, 10) + bin(4, 4),
    );
  });

  it("非数字を含むとエラー", () => {
    expect(() => makeNumericSegment("12a")).toThrow(/non-digit/);
  });
});

describe("makeAlphanumericSegment", () => {
  it('"AC-42" が既知のペア値(462, 1849)どおりに符号化される', () => {
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

  it("集合外の文字(小文字)はエラー", () => {
    expect(() => makeAlphanumericSegment("Ab")).toThrow(/invalid character/);
  });
});

describe("makeByteSegment", () => {
  it("ASCII文字列は1文字1バイト", () => {
    const seg = makeByteSegment("abc");
    expect(seg.numChars).toBe(3);
    expect(seg.dataBits).toBe(24);
    expect(toBitString(seg, 1)).toBe(
      bin(0b0100, 4) + bin(3, 8) + bin(0x61, 8) + bin(0x62, 8) + bin(0x63, 8),
    );
  });

  it("文字数指示子はUTF-8のバイト数(日本語は1文字3バイト)", () => {
    const seg = makeByteSegment("あ"); // U+3042 → E3 81 82
    expect(seg.numChars).toBe(3);
    expect(toBitString(seg, 1)).toBe(
      bin(0b0100, 4) + bin(3, 8) + bin(0xe3, 8) + bin(0x81, 8) + bin(0x82, 8),
    );
  });

  it("Uint8Arrayをそのまま受け取れる", () => {
    const seg = makeByteSegment(new Uint8Array([0xff, 0x00]));
    expect(seg.numChars).toBe(2);
  });
});

describe("makeSegments: 自動モード選択", () => {
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

describe("writeSegment / segmentBits: 文字数指示子の上限", () => {
  it("v1-9のByteモード(8bit指示子)に256バイトは書けない", () => {
    const seg = makeByteSegment(new Uint8Array(256));
    expect(segmentBits(seg, 9)).toBe(Infinity);
    expect(() => toBitString(seg, 9)).toThrow(RangeError);
    // Writable from v10 on (16 bits)
    expect(segmentBits(seg, 10)).toBe(4 + 16 + 2048);
  });
});

describe("makeKanjiSegment", () => {
  it('ISO/IEC 18004の符号化例 "点茗" と一致する', () => {
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

  it("Kanjiモードで表せない文字はエラー", () => {
    expect(() => makeKanjiSegment("あA")).toThrow(/not encodable/);
    expect(() => makeKanjiSegment("ｱ")).toThrow(/not encodable/); // half-width katakana
  });

  it("同じ日本語文字列でByteモードより短い(13bit/文字 vs 24bit/文字)", () => {
    const text = "こんにちは世界";
    const kanji = makeKanjiSegment(text);
    const byte = makeByteSegment(text);
    expect(kanji.dataBits).toBe(7 * 13);
    expect(byte.dataBits).toBe(21 * 8);
    expect(kanji.dataBits).toBeLessThan(byte.dataBits);
  });
});

describe("detectMode: Kanji", () => {
  it("全角のみの文字列 → kanji", () => {
    expect(detectMode("こんにちは")).toBe("kanji");
    expect(detectMode("漢字、カタカナ。全角Ａも")).toBe("kanji");
  });

  it("ASCII混在・絵文字・半角カナ → byte", () => {
    expect(detectMode("こんにちはA")).toBe("byte");
    expect(detectMode("こんにちは123")).toBe("byte");
    expect(detectMode("絵文字🎌入り")).toBe("byte");
    expect(detectMode("ﾊﾝｶｸｶﾅ")).toBe("byte");
  });
});

describe("ccBits: Kanjiモードの文字数指示子", () => {
  it("バージョン帯ごとの幅が仕様どおり", () => {
    expect(ccBits("kanji", 1)).toBe(8);
    expect(ccBits("kanji", 9)).toBe(8);
    expect(ccBits("kanji", 10)).toBe(10);
    expect(ccBits("kanji", 26)).toBe(10);
    expect(ccBits("kanji", 27)).toBe(12);
  });
});
