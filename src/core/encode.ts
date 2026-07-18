import { assertVersion, type ECLevel } from "./capacity";
import {
  buildCodewords,
  chooseVersion as chooseVersionForSegments,
} from "./codewords";
import { buildMatrix, type QRMatrix } from "./matrix";
import { makeByteSegment, makeSegments, type Segment } from "./segments";

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
  /**
   * Allow kanji mode in automatic mode detection (default true). Kanji
   * detection depends on the runtime's TextDecoder("shift_jis") support, so
   * set this to false when the exact module pattern must be identical across
   * environments (e.g. server-rendered markup hydrated in a different
   * runtime).
   */
  allowKanji?: boolean | undefined;
}

/**
 * Generates a QR matrix from a string or byte array (the core's top-level
 * API).
 *
 * Strings get automatic mode detection (digits -> Numeric, the alphanumeric
 * charset -> Alphanumeric, all double-byte SJIS -> Kanji, anything else ->
 * Byte/UTF-8). A Uint8Array always uses Byte mode. Kanji detection can be
 * turned off with `allowKanji: false` for environment-independent output.
 *
 * @throws {RangeError} when data is neither a string nor a Uint8Array, or an
 *                      option is invalid
 * @throws {Error} when the data does not fit the requested version/level
 */
export function encode(
  data: string | Uint8Array,
  options: EncodeOptions = {},
): QRMatrix {
  const {
    ecLevel = "M",
    version,
    minVersion = 1,
    mask = -1,
    allowKanji = true,
  } = options;
  const segments = toSegments(data, "encode", allowKanji);
  let v: number;
  if (version !== undefined) {
    assertVersion(version);
    v = version;
  } else {
    v = chooseVersionForSegments(segments, ecLevel, minVersion);
  }
  return buildMatrix(buildCodewords(segments, v, ecLevel), v, ecLevel, mask);
}

/**
 * Returns the smallest version (1-40) that can hold the data at the given
 * error correction level — the version encode() auto-selects. Useful to
 * check whether (and at what symbol size) data will fit before rendering.
 *
 * @throws {RangeError} when data is neither a string nor a Uint8Array, or
 *                      minVersion is invalid
 * @throws {Error} when the data does not fit any version at the level
 */
export function chooseVersion(
  data: string | Uint8Array,
  options: Pick<EncodeOptions, "ecLevel" | "minVersion" | "allowKanji"> = {},
): number {
  const { ecLevel = "M", minVersion = 1, allowKanji = true } = options;
  return chooseVersionForSegments(
    toSegments(data, "chooseVersion", allowKanji),
    ecLevel,
    minVersion,
  );
}

/**
 * Validates public-API input and builds its segment list.
 * @param fn public function name used as the error message prefix
 */
function toSegments(
  data: string | Uint8Array,
  fn: string,
  allowKanji: boolean,
): Segment[] {
  if (typeof data !== "string" && !(data instanceof Uint8Array)) {
    throw new RangeError(`${fn}: data must be a string or Uint8Array`);
  }
  // Numeric's 7,089 digits (v40-L) is the largest count any mode can hold,
  // and UTF-8 never yields fewer bytes than UTF-16 code units, so longer
  // inputs can never fit any version. Reject before any O(n) segment work.
  const maxLength = typeof data === "string" ? 7089 : 2953;
  if (data.length > maxLength) {
    throw new Error(
      `${fn}: data too long for any version (${data.length} > ${maxLength})`,
    );
  }
  return typeof data === "string"
    ? makeSegments(data, { allowKanji })
    : [makeByteSegment(data)];
}
