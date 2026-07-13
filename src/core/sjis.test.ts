import { describe, expect, it } from "vitest";
import { isKanjiEncodable, kanjiModeAvailable, sjisCode } from "./sjis";

describe("sjis: 実行時逆引きテーブル", () => {
  it("この環境(Node/full-icu)ではKanjiモードが利用できる", () => {
    expect(kanjiModeAvailable()).toBe(true);
  });

  it("既知のShift-JIS符号と一致する", () => {
    expect(sjisCode("あ")).toBe(0x82a0);
    expect(sjisCode("ア")).toBe(0x8341); // full-width katakana
    expect(sjisCode("。")).toBe(0x8142);
    expect(sjisCode("、")).toBe(0x8141);
    expect(sjisCode("点")).toBe(0x935f); // character from the ISO/IEC 18004 worked example
    expect(sjisCode("茗")).toBe(0xe4aa); // same example (the 0xE040+ range)
  });

  it("1バイトSJIS(ASCII・半角カナ)はKanjiモード対象外", () => {
    expect(sjisCode("A")).toBeUndefined();
    expect(sjisCode("1")).toBeUndefined();
    expect(sjisCode(" ")).toBeUndefined();
    expect(sjisCode("ｱ")).toBeUndefined(); // half-width katakana U+FF71
  });

  it("サロゲートペア(絵文字)は対象外", () => {
    const emoji = "🎌";
    expect(sjisCode(emoji[0]!)).toBeUndefined();
    expect(sjisCode(emoji[1]!)).toBeUndefined();
    expect(isKanjiEncodable(emoji)).toBe(false);
  });

  it("CP932の重複符号は標準JIS側(小さい符号)が採用される", () => {
    // U+2252 exists both at 0x81E0 (standard JIS X 0208) and 0x8790 (NEC special row)
    expect(sjisCode("≒")).toBe(0x81e0);
    expect(sjisCode("≡")).toBe(0x81df);
  });

  it("返される符号はすべてQRのKanjiモード範囲内", () => {
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

  it("isKanjiEncodable: 全角のみtrue、ASCII混在・空文字はfalse", () => {
    expect(isKanjiEncodable("こんにちは世界")).toBe(true);
    expect(isKanjiEncodable("漢字とカナと。全角Ａ")).toBe(true);
    expect(isKanjiEncodable("こんにちはA")).toBe(false);
    expect(isKanjiEncodable("")).toBe(false);
  });
});
