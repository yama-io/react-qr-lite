import { describe, expect, it } from "vitest";
import { BitBuffer } from "./bitbuffer";

describe("BitBuffer: 基本の書き込み", () => {
  it("QRのByteモード先頭を模したパターン: put(0b0100,4) + put(11,8)", () => {
    const buf = new BitBuffer();
    buf.put(0b0100, 4); // mode indicator (Byte)
    buf.put(11, 8); // character count indicator
    expect(buf.length).toBe(12);
    expect(buf.byteLength).toBe(2);
    // Bit stream: 0100 00001011 -> 01000000, 1011(0000)
    expect(Array.from(buf.toUint8Array())).toEqual([0b01000000, 0b10110000]);
  });

  it("putBit の連続とビット順(MSBファースト)", () => {
    const buf = new BitBuffer();
    // 10110001, one bit at a time
    for (const b of [1, 0, 1, 1, 0, 0, 0, 1] as const) buf.putBit(b);
    expect(buf.toUint8Array()[0]).toBe(0b10110001);
    expect(buf.getBit(0)).toBe(1);
    expect(buf.getBit(1)).toBe(0);
    expect(buf.getBit(7)).toBe(1);
  });

  it("put(value, 0) は何もしない", () => {
    const buf = new BitBuffer();
    buf.put(0, 0);
    expect(buf.length).toBe(0);
    expect(buf.toUint8Array().length).toBe(0);
  });

  it("バイト境界をまたぐ書き込み(13bit値など)", () => {
    const buf = new BitBuffer();
    buf.put(0b101, 3);
    buf.put(0b1111000011111, 13); // kanji-mode payload width
    expect(buf.length).toBe(16);
    expect(Array.from(buf.toUint8Array())).toEqual([0b10111110, 0b00011111]);
  });

  it("30bit(上限)の書き込み", () => {
    const buf = new BitBuffer();
    const v = (1 << 30) - 1;
    buf.put(v, 30);
    expect(buf.length).toBe(30);
    expect(Array.from(buf.toUint8Array())).toEqual([
      0xff, 0xff, 0xff, 0b11111100,
    ]);
  });
});

describe("BitBuffer: putBytes", () => {
  it("バイト境界に揃っている場合の一括コピー", () => {
    const buf = new BitBuffer();
    buf.put(0xab, 8);
    buf.putBytes(new Uint8Array([0x01, 0x02, 0x03]));
    expect(buf.length).toBe(32);
    expect(Array.from(buf.toUint8Array())).toEqual([0xab, 0x01, 0x02, 0x03]);
  });

  it("境界に揃っていない場合も正しい(ビットずれ書き込み)", () => {
    const buf = new BitBuffer();
    buf.put(0b1, 1);
    buf.putBytes(new Uint8Array([0xff, 0x00]));
    expect(buf.length).toBe(17);
    // 1 11111111 00000000 → 11111111 10000000 0(0000000)
    expect(Array.from(buf.toUint8Array())).toEqual([0xff, 0x80, 0x00]);
  });
});

describe("BitBuffer: 容量拡張", () => {
  it("初期容量を超えても正しく保持する", () => {
    const buf = new BitBuffer(1); // start from a single byte
    const values: number[] = [];
    for (let i = 0; i < 500; i++) {
      const v = (i * 37) & 0xff;
      values.push(v);
      buf.put(v, 8);
    }
    expect(buf.length).toBe(4000);
    expect(Array.from(buf.toUint8Array())).toEqual(values);
  });

  it("拡張後の末尾未使用ビットは0", () => {
    const buf = new BitBuffer(1);
    for (let i = 0; i < 100; i++) buf.put(1, 3); // 300bit
    const bytes = buf.toUint8Array();
    expect(bytes.length).toBe(38); // ceil(300/8)
    // Bits from 300 on (the low 4 bits of the final byte) are 0
    expect(bytes[37]! & 0x0f).toBe(0);
  });
});

describe("BitBuffer: エラー処理", () => {
  it("numBits が範囲外なら RangeError", () => {
    const buf = new BitBuffer();
    expect(() => buf.put(0, -1)).toThrow(RangeError);
    expect(() => buf.put(0, 31)).toThrow(RangeError);
  });

  it("value が numBits に収まらなければ RangeError", () => {
    const buf = new BitBuffer();
    expect(() => buf.put(16, 4)).toThrow(RangeError);
    expect(() => buf.put(-1, 8)).toThrow(RangeError);
  });

  it("getBit の範囲外アクセスは RangeError", () => {
    const buf = new BitBuffer();
    buf.put(0xff, 8);
    expect(() => buf.getBit(-1)).toThrow(RangeError);
    expect(() => buf.getBit(8)).toThrow(RangeError);
  });
});
