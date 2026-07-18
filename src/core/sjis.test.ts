import { describe, expect, it } from "vitest";
import { isKanjiEncodable, kanjiModeAvailable, sjisCode } from "./sjis";

describe("sjis: runtime reverse lookup table", () => {
  it("kanji mode is available in this environment (Node/full-icu)", () => {
    expect(kanjiModeAvailable()).toBe(true);
  });

  it("matches known Shift-JIS codes", () => {
    expect(sjisCode("あ")).toBe(0x82a0);
    expect(sjisCode("ア")).toBe(0x8341); // full-width katakana
    expect(sjisCode("。")).toBe(0x8142);
    expect(sjisCode("、")).toBe(0x8141);
    expect(sjisCode("点")).toBe(0x935f); // character from the ISO/IEC 18004 worked example
    expect(sjisCode("茗")).toBe(0xe4aa); // same example (the 0xE040+ range)
  });

  it("single-byte SJIS (ASCII, half-width kana) is outside kanji mode", () => {
    expect(sjisCode("A")).toBeUndefined();
    expect(sjisCode("1")).toBeUndefined();
    expect(sjisCode(" ")).toBeUndefined();
    expect(sjisCode("ｱ")).toBeUndefined(); // half-width katakana U+FF71
  });

  it("surrogate pairs (emoji) are not covered", () => {
    const emoji = "🎌";
    expect(sjisCode(emoji[0]!)).toBeUndefined();
    expect(sjisCode(emoji[1]!)).toBeUndefined();
    expect(isKanjiEncodable(emoji)).toBe(false);
  });

  it("CP932 duplicate codes resolve to the standard JIS (lower) code", () => {
    // U+2252 exists both at 0x81E0 (standard JIS X 0208) and 0x8790 (NEC special row)
    expect(sjisCode("≒")).toBe(0x81e0);
    expect(sjisCode("≡")).toBe(0x81df);
  });

  it("all returned codes are within the QR kanji-mode ranges", () => {
    for (const ch of ["あ", "ん", "漢", "字", "熙", "①", "Ａ", "ａ"]) {
      const code = sjisCode(ch);
      if (code === undefined) continue;
      const inRange =
        (code >= 0x8140 && code <= 0x9ffc) ||
        (code >= 0xe040 && code <= 0xebbf);
      expect(inRange, `${ch} = 0x${code.toString(16)}`).toBe(true);
      expect(code & 0xff).not.toBe(0x7f);
      expect(code & 0xff).toBeGreaterThanOrEqual(0x40);
    }
  });

  it("isKanjiEncodable: true only for all-double-byte, false for mixed ASCII or empty", () => {
    expect(isKanjiEncodable("こんにちは世界")).toBe(true);
    expect(isKanjiEncodable("漢字とカナと。全角Ａ")).toBe(true);
    expect(isKanjiEncodable("こんにちはA")).toBe(false);
    expect(isKanjiEncodable("")).toBe(false);
  });
});
