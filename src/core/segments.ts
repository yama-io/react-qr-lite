import type { BitBuffer } from "./bitbuffer";
import { isKanjiEncodable, sjisCode } from "./sjis";

/**
 * Segment encoding — the layer that turns input strings into QR data bit
 * streams.
 *
 * The data portion of a QR code is a sequence of segments, each consisting
 * of "mode indicator (4 bits) + character count indicator (version-dependent
 * width) + payload".
 *
 * Supported modes:
 * - Numeric      (0b0001): digits only. 3 digits -> 10 bits; the densest mode
 * - Alphanumeric (0b0010): digits + uppercase letters + 9 symbols. 2 chars -> 11 bits
 * - Byte         (0b0100): arbitrary bytes (strings are encoded as UTF-8). 1 byte -> 8 bits
 * - Kanji        (0b1000): double-byte Shift-JIS characters from JIS X 0208. 1 char -> 13 bits
 *   (the reverse lookup table is built at runtime from TextDecoder by sjis.ts)
 *
 * TODO: multi-segment splitting optimization for mixed strings (e.g. carving
 *       long digit runs into Numeric segments). For now the whole string is
 *       encoded in a single mode.
 */

export type Mode = "numeric" | "alphanumeric" | "byte" | "kanji";

/** Options for detectMode / makeSegments. */
export interface DetectModeOptions {
  /**
   * Whether kanji mode may be chosen (default true). Kanji detection depends
   * on the runtime's TextDecoder("shift_jis") support, so set this to false
   * when the exact module pattern must be identical across environments
   * (e.g. server-rendered markup hydrated in a different runtime).
   */
  allowKanji?: boolean | undefined;
}

/** Mode indicators (4 bits) */
export const MODE_INDICATOR: Readonly<Record<Mode, number>> = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
  kanji: 0b1000,
};

/** Character count indicator widths in bits: [ver 1-9, ver 10-26, ver 27-40] */
const CC_BITS: Readonly<Record<Mode, readonly [number, number, number]>> = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
  kanji: [8, 10, 12],
};

/** Returns the character count indicator width for the given version. */
export function ccBits(mode: Mode, version: number): number {
  return CC_BITS[mode][version <= 9 ? 0 : version <= 26 ? 1 : 2];
}

/**
 * A single segment. Holds the mode, the character count, and how to write
 * the payload bits. Input validation and conversion (UTF-8 encoding,
 * alphanumeric value mapping) happen once at construction time.
 */
export interface Segment {
  readonly mode: Mode;
  /** Value for the character count indicator (byte count in Byte mode) */
  readonly numChars: number;
  /** Number of payload bits (excluding mode and count indicators) */
  readonly dataBits: number;
  /** Writes the payload bits into the buffer */
  writeData(buf: BitBuffer): void;
}

/* ------------------------------------------------------------------ */
/* Character tables (generated at runtime)                              */
/* ------------------------------------------------------------------ */

/** Alphanumeric mode character set (value = index in this string) */
export const ALPHANUMERIC_CHARSET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/** charCode -> alphanumeric mode value (-1 if absent). ASCII range only. */
const ALNUM_VALUE = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHANUMERIC_CHARSET.length; i++) {
  ALNUM_VALUE[ALPHANUMERIC_CHARSET.charCodeAt(i)] = i;
}

const textEncoder = new TextEncoder();

/* ------------------------------------------------------------------ */
/* Mode detection                                                       */
/* ------------------------------------------------------------------ */

/** Returns the densest mode that can represent the whole string as one segment. */
export function detectMode(text: string, options: DetectModeOptions = {}): Mode {
  const { allowKanji = true } = options;
  let alnum = true;
  let numeric = true;
  let hasAscii = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) hasAscii = true;
    if (c < 48 || c > 57) {
      numeric = false;
      if (c >= 128 || ALNUM_VALUE[c]! < 0) {
        alnum = false;
        // Any ASCII rules out kanji mode, so we can stop early
        if (hasAscii) break;
      }
    }
  }
  if (numeric) return "numeric";
  if (alnum) return "alphanumeric";
  // Strings containing ASCII (single-byte SJIS) cannot use kanji mode.
  // Kanji applies only when every char maps to double-byte SJIS
  // (13 bits/char, versus 24 bits/char for UTF-8 in byte mode)
  if (!hasAscii && allowKanji && isKanjiEncodable(text)) return "kanji";
  return "byte";
}

/* ------------------------------------------------------------------ */
/* Segment constructors                                                 */
/* ------------------------------------------------------------------ */

/** Numeric segment. 3 digits -> 10 bits; a 2-digit remainder -> 7 bits; 1 digit -> 4 bits. */
export function makeNumericSegment(digits: string): Segment {
  for (let i = 0; i < digits.length; i++) {
    const c = digits.charCodeAt(i);
    if (c < 48 || c > 57) {
      throw new Error(`makeNumericSegment: non-digit at index ${i}`);
    }
  }
  const n = digits.length;
  const rem = n % 3;
  return {
    mode: "numeric",
    numChars: n,
    dataBits: Math.floor(n / 3) * 10 + (rem === 1 ? 4 : rem === 2 ? 7 : 0),
    writeData(buf) {
      let i = 0;
      for (; i + 3 <= n; i += 3) {
        buf.put(
          (digits.charCodeAt(i) - 48) * 100 +
            (digits.charCodeAt(i + 1) - 48) * 10 +
            (digits.charCodeAt(i + 2) - 48),
          10,
        );
      }
      if (rem === 1) {
        buf.put(digits.charCodeAt(i) - 48, 4);
      } else if (rem === 2) {
        buf.put(
          (digits.charCodeAt(i) - 48) * 10 + (digits.charCodeAt(i + 1) - 48),
          7,
        );
      }
    },
  };
}

/** Alphanumeric segment. 2 chars -> 11 bits (a*45+b); an odd final char -> 6 bits. */
export function makeAlphanumericSegment(text: string): Segment {
  const n = text.length;
  const values = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    const v = c < 128 ? ALNUM_VALUE[c]! : -1;
    if (v < 0) {
      throw new Error(
        `makeAlphanumericSegment: invalid character at index ${i}`,
      );
    }
    values[i] = v;
  }
  return {
    mode: "alphanumeric",
    numChars: n,
    dataBits: Math.floor(n / 2) * 11 + (n % 2) * 6,
    writeData(buf) {
      let i = 0;
      for (; i + 2 <= n; i += 2) {
        buf.put(values[i]! * 45 + values[i + 1]!, 11);
      }
      if (i < n) buf.put(values[i]!, 6);
    },
  };
}

/** Byte segment. Strings are encoded as UTF-8; the count indicator holds the byte count. */
export function makeByteSegment(data: string | Uint8Array): Segment {
  const bytes = typeof data === "string" ? textEncoder.encode(data) : data;
  return {
    mode: "byte",
    numChars: bytes.length,
    dataBits: bytes.length * 8,
    writeData(buf) {
      buf.putBytes(bytes);
    },
  };
}

/**
 * Kanji segment. Encodes double-byte Shift-JIS characters from JIS X 0208 at
 * 13 bits per character. Codes are offset (0x8140-0x9FFC -> -0x8140,
 * 0xE040-0xEBBF -> -0xC140), then packed as high byte * 0xC0 + low byte into
 * a 13-bit value (ISO/IEC 18004 8.4.5).
 * @throws {Error} when the text contains characters not representable in
 *                 kanji mode, or when this environment's TextDecoder does
 *                 not support shift_jis
 */
export function makeKanjiSegment(text: string): Segment {
  const n = text.length;
  const values = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const code = sjisCode(text[i]!);
    if (code === undefined) {
      throw new Error(
        `makeKanjiSegment: character at index ${i} is not encodable in kanji mode`,
      );
    }
    const c = code - (code < 0xe040 ? 0x8140 : 0xc140);
    values[i] = (c >> 8) * 0xc0 + (c & 0xff);
  }
  return {
    mode: "kanji",
    numChars: n,
    dataBits: n * 13,
    writeData(buf) {
      for (let i = 0; i < n; i++) buf.put(values[i]!, 13);
    },
  };
}

/**
 * Builds the optimal segment list for a string.
 * Currently a single segment with auto-detected mode.
 */
export function makeSegments(
  text: string,
  options: DetectModeOptions = {},
): Segment[] {
  const mode = detectMode(text, options);
  if (mode === "numeric") return [makeNumericSegment(text)];
  if (mode === "alphanumeric") return [makeAlphanumericSegment(text)];
  if (mode === "kanji") return [makeKanjiSegment(text)];
  return [makeByteSegment(text)];
}

/* ------------------------------------------------------------------ */
/* Writing and size calculation                                         */
/* ------------------------------------------------------------------ */

/**
 * Total bit length of a segment (mode indicator + count indicator + payload).
 * Returns Infinity when numChars does not fit in the count indicator at the
 * given version (meaning: not representable at that version).
 */
export function segmentBits(seg: Segment, version: number): number {
  const cc = ccBits(seg.mode, version);
  if (seg.numChars >= 1 << cc) return Infinity;
  return 4 + cc + seg.dataBits;
}

/** Total bit length of all segments (Infinity if not representable). */
export function totalBits(segments: readonly Segment[], version: number): number {
  let sum = 0;
  for (const seg of segments) {
    sum += segmentBits(seg, version);
  }
  return sum;
}

/**
 * Writes one segment (mode indicator + count indicator + payload).
 * @throws {RangeError} when numChars does not fit in this version's count indicator
 */
export function writeSegment(
  buf: BitBuffer,
  seg: Segment,
  version: number,
): void {
  const cc = ccBits(seg.mode, version);
  if (seg.numChars >= 1 << cc) {
    throw new RangeError(
      `writeSegment: ${seg.numChars} chars does not fit in ${cc}-bit count indicator (version ${version})`,
    );
  }
  buf.put(MODE_INDICATOR[seg.mode], 4);
  buf.put(seg.numChars, cc);
  seg.writeData(buf);
}
