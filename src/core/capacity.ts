/**
 * Version capacity and block structure (equivalent to ISO/IEC 18004 Table 9).
 *
 * To keep the bundle small we do not embed the spec's large table directly;
 * it is represented in two parts instead:
 *
 * 1. The total codeword count per version is **derived by calculation** from
 *    the symbol structure (module counts of the function patterns) — no table
 * 2. Per error correction level x version, only two small tables are needed:
 *    "EC codewords per block" and "number of blocks". Each block's data
 *    length is then uniquely determined by the total codeword count
 *    (short blocks first; long blocks carry one extra byte)
 */

export type ECLevel = "L" | "M" | "Q" | "H";

export const EC_LEVELS: readonly ECLevel[] = ["L", "M", "Q", "H"];

const EC_INDEX: Readonly<Record<ECLevel, number>> = { L: 0, M: 1, Q: 2, H: 3 };

/** Error correction codewords per block: [L,M,Q,H][version-1] */
// prettier-ignore
const ECC_PER_BLOCK: readonly (readonly number[])[] = [
  [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

/** Number of error correction blocks: [L,M,Q,H][version-1] */
// prettier-ignore
const NUM_BLOCKS: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** Validates a version number (integer 1-40). */
export function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new RangeError(`invalid QR version: ${version}`);
  }
}

/**
 * Total codeword count of a version (data + error correction).
 *
 * Computed as the number of data-region modules — the full module count
 * minus the function patterns (finders + separators, timing, alignment,
 * format info, version info) — divided by 8. A closed-form expression
 * rather than a table.
 */
export function totalCodewords(version: number): number {
  assertVersion(version);
  // Expanded form of (4v+17)^2 minus the three finders + separators (192)
  // and the timing and format info modules
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    // Alignment patterns (adjusted for overlap with the timing patterns)
    modules -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) modules -= 36; // version info: 18 bits x 2
  }
  return modules >> 3;
}

/** Block structure for a version x error correction level. */
export interface Capacity {
  readonly version: number;
  readonly ecLevel: ECLevel;
  /** Total codewords (data + EC) */
  readonly totalCodewords: number;
  /** Total number of data codewords */
  readonly dataCodewords: number;
  /** Error correction codewords per block */
  readonly ecPerBlock: number;
  /** Total number of blocks */
  readonly numBlocks: number;
  /** Number of short blocks (one data byte fewer); they come first in the sequence */
  readonly numShortBlocks: number;
  /** Data codewords in a short block */
  readonly shortBlockDataLen: number;
}

const capacityCache = new Map<number, Capacity>();

/** Returns the block structure for a version and EC level (results are cached). */
export function getCapacity(version: number, ecLevel: ECLevel): Capacity {
  assertVersion(version);
  const ecIdx = EC_INDEX[ecLevel];
  if (ecIdx === undefined) {
    throw new RangeError(`invalid EC level: ${String(ecLevel)}`);
  }
  const key = version * 4 + ecIdx;
  const cached = capacityCache.get(key);
  if (cached) return cached;

  const total = totalCodewords(version);
  const ecPerBlock = ECC_PER_BLOCK[ecIdx]![version - 1]!;
  const numBlocks = NUM_BLOCKS[ecIdx]![version - 1]!;
  const capacity: Capacity = {
    version,
    ecLevel,
    totalCodewords: total,
    dataCodewords: total - ecPerBlock * numBlocks,
    ecPerBlock,
    numBlocks,
    numShortBlocks: numBlocks - (total % numBlocks),
    shortBlockDataLen: Math.floor(total / numBlocks) - ecPerBlock,
  };
  capacityCache.set(key, capacity);
  return capacity;
}
