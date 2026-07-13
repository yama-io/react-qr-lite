import { assertVersion, type ECLevel } from "./capacity";
import { buildCodewords, chooseVersion } from "./codewords";
import { buildMatrix, type QRMatrix } from "./matrix";
import { makeByteSegment, makeSegments } from "./segments";

/** Options for encode. */
export interface EncodeOptions {
  /** Error correction level (default "M") */
  ecLevel?: ECLevel | undefined;
  /** Pin the version (defaults to the smallest version that fits) */
  version?: number | undefined;
  /** Minimum version for auto-selection (default 1) */
  minVersion?: number | undefined;
  /** Mask number 0-7 (default -1 = auto-select the lowest penalty) */
  mask?: number | undefined;
}

/**
 * Generates a QR matrix from a string or byte array (the core's top-level
 * API).
 *
 * Strings get automatic mode detection (digits -> Numeric, the alphanumeric
 * charset -> Alphanumeric, all double-byte SJIS -> Kanji, anything else ->
 * Byte/UTF-8). A Uint8Array always uses Byte mode.
 */
export function encode(
  data: string | Uint8Array,
  options: EncodeOptions = {},
): QRMatrix {
  const { ecLevel = "M", version, minVersion = 1, mask = -1 } = options;
  const segments =
    typeof data === "string" ? makeSegments(data) : [makeByteSegment(data)];
  let v: number;
  if (version !== undefined) {
    assertVersion(version);
    v = version;
  } else {
    v = chooseVersion(segments, ecLevel, minVersion);
  }
  return buildMatrix(buildCodewords(segments, v, ecLevel), v, ecLevel, mask);
}
