import { getCapacity, type ECLevel } from "./capacity";

/**
 * Matrix placement and mask evaluation — the layer that turns a codeword
 * sequence into a 2D module array.
 *
 * Components:
 * - Function patterns: finders (3 corners) + separators, timing, alignment,
 *   and the dark module
 * - Format info: BCH(15,5)-encoded EC level + mask number (two copies)
 * - Version info (v7+): BCH(18,6)-encoded (two copies)
 * - Data: zigzag placement over 2-column strips from the bottom right
 * - Masks: 8 periodic patterns; auto-selection picks the lowest 4-rule
 *   penalty score
 *
 * Coordinates are (x, y) = (column, row). `modules` is a row-major flat
 * array where 1 = dark.
 */

export interface QRMatrix {
  /** Modules per side (= version * 4 + 17) */
  readonly size: number;
  readonly version: number;
  readonly ecLevel: ECLevel;
  /** Applied mask number (0-7) */
  readonly mask: number;
  /** Row-major module array. 1 = dark, 0 = light */
  readonly modules: Uint8Array;
}

/** Returns the module at (x, y) (1 = dark). */
export function getModule(matrix: QRMatrix, x: number, y: number): number {
  return matrix.modules[y * matrix.size + x]!;
}

/* ------------------------------------------------------------------ */
/* Format and version info (BCH codes)                                  */
/* ------------------------------------------------------------------ */

/** EC level bits in the format info (per spec: L=01, M=00, Q=11, H=10) */
const ECL_FORMAT_BITS: Readonly<Record<ECLevel, number>> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

/**
 * The 15 format info bits: [EC level, 2 bits | mask, 3 bits] + 10-bit
 * BCH(15,5) remainder, finally XORed with the constant mask 0x5412.
 * Generator polynomial: x^10+x^8+x^5+x^4+x^2+x+1 (0x537).
 */
export function formatBits(ecLevel: ECLevel, mask: number): number {
  const data = (ECL_FORMAT_BITS[ecLevel] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/**
 * The 18 version info bits (v7+): 6 version bits + 12-bit BCH(18,6) remainder.
 * Generator polynomial: x^12+x^11+x^10+x^9+x^8+x^5+x^2+1 (0x1F25).
 */
export function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
  }
  return (version << 12) | rem;
}

/* ------------------------------------------------------------------ */
/* Alignment pattern positions                                          */
/* ------------------------------------------------------------------ */

/**
 * The list of alignment pattern center coordinates, derived by a closed-form
 * expression instead of the spec's table. The first is always 6, the last is
 * size-7, and intermediate centers step back from the end at an even
 * interval. Version 32 is the lone exception (its even split is not an even
 * number) and uses a step of 26.
 */
export function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step =
    version === 32
      ? 26
      : Math.floor((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) {
    result.splice(1, 0, pos);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Mask patterns (12x12 periodic tables, generated at runtime)          */
/* ------------------------------------------------------------------ */

/**
 * Mask conditions (i = row, j = column), ISO/IEC 18004 Table 10.
 * Every condition's period divides 12 in both axes (combinations of %2, %3,
 * floor(i/2) and floor(j/3)), so a 12x12 table applies them without
 * branching. All 8 masks total 1152 bytes.
 */
const MASK_CONDITIONS: readonly ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => ((i >> 1) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/** Per-mask 12x12 tables. index = (y % 12) * 12 + (x % 12); values are 0/1. */
const MASK_TABLES: readonly Uint8Array[] = MASK_CONDITIONS.map((cond) => {
  const table = new Uint8Array(144);
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      table[i * 12 + j] = cond(i, j) ? 1 : 0;
    }
  }
  return table;
});

/* ------------------------------------------------------------------ */
/* Penalty evaluation                                                   */
/* ------------------------------------------------------------------ */

const N3_PATTERN_A = 0b10111010000; // 0x5D0: 1011101 followed by 4 light
const N3_PATTERN_B = 0b00001011101; // 0x05D: 4 light followed by 1011101
const N3_WINDOW_MASK = 0x7ff;

/** Expands a 12x12 mask table to full row width (removes %12 from the inner loop). */
function expandMaskRows(table: Uint8Array, size: number): Uint8Array {
  const rows = new Uint8Array(12 * size);
  for (let p = 0; p < 12; p++) {
    const src = p * 12;
    const dst = p * size;
    for (let x = 0; x < size; x++) {
      rows[dst + x] = table[src + (x % 12)]!;
    }
  }
  return rows;
}

/**
 * Single-pass evaluation that fuses mask application with penalty scoring.
 *
 * Rather than materializing the matrix for each mask candidate, module
 * values are XORed on the fly as they are read and all four rules are
 * evaluated simultaneously. Column-direction state (run lengths, 11-bit
 * windows) lives in per-column arrays, and N2 (2x2 blocks) needs only the
 * previous row's buffer. Mask application is the branchless
 * `modules ^ (maskRow & notFunc)` (function patterns have notFunc = 0,
 * so their XOR term vanishes).
 *
 * - N1: +3 for 5 same-color modules in a row, +1 per extra module (rows & columns)
 * - N2: +3 per same-color 2x2 block (overlapping blocks count)
 * - N3: +40 per 1:1:3:1:1 pattern with 4 light modules on either side
 *       (0x5D0 / 0x05D) (rows & columns)
 * - N4: +10 per 5% deviation of the dark-module ratio from 50%
 *
 * @param notFunc 1 = maskable (non-function) module
 * @param maskRows mask rows pre-expanded by expandMaskRows (12 x size)
 */
function evaluatePenalty(
  modules: Uint8Array,
  size: number,
  notFunc: Uint8Array,
  maskRows: Uint8Array,
): number {
  let penalty = 0;
  let dark = 0;
  const colRunColor = new Uint8Array(size);
  const colRunLen = new Int32Array(size);
  const colWindow = new Int32Array(size);
  const prevRow = new Uint8Array(size);

  for (let y = 0; y < size; y++) {
    const rowBase = y * size;
    const maskRowBase = (y % 12) * size;
    let runColor = -1;
    let runLen = 0;
    let window = 0;
    let left = 0; // module one to the left in the current row
    let aboveLeft = 0; // module one to the left in the previous row
    for (let x = 0; x < size; x++) {
      const idx = rowBase + x;
      const m = modules[idx]! ^ (maskRows[maskRowBase + x]! & notFunc[idx]!);
      dark += m;

      // N1, row direction (incremental: +3 at a run of 5, +1 per module after)
      if (m === runColor) {
        runLen++;
        if (runLen === 5) penalty += 3;
        else if (runLen > 5) penalty += 1;
      } else {
        runColor = m;
        runLen = 1;
      }
      // N1, column direction
      if (m === colRunColor[x]) {
        const len = ++colRunLen[x]!;
        if (len === 5) penalty += 3;
        else if (len > 5) penalty += 1;
      } else {
        colRunColor[x] = m;
        colRunLen[x] = 1;
      }

      // N3, both directions (11-bit sliding windows)
      window = ((window << 1) | m) & N3_WINDOW_MASK;
      if (x >= 10 && (window === N3_PATTERN_A || window === N3_PATTERN_B)) {
        penalty += 40;
      }
      const cw = (((colWindow[x]! << 1) | m) & N3_WINDOW_MASK);
      colWindow[x] = cw;
      if (y >= 10 && (cw === N3_PATTERN_A || cw === N3_PATTERN_B)) {
        penalty += 40;
      }

      // N2 (same-color 2x2). prevRow[x] still holds the previous row's value (overwritten below)
      const above = prevRow[x]!;
      if (y > 0 && x > 0 && m === left && m === above && m === aboveLeft) {
        penalty += 3;
      }
      aboveLeft = above;
      left = m;
      prevRow[x] = m;
    }
  }

  // N4: dark-ratio deviation. floor(|ratio - 50| / 5) * 10 in integer arithmetic
  const total = size * size;
  penalty += Math.floor(Math.abs(20 * dark - 10 * total) / total) * 10;
  return penalty;
}

/** Penalty score of a finished matrix (sum of the four ISO/IEC 18004 rules). */
export function penaltyScore(matrix: QRMatrix): number {
  const { size } = matrix;
  // maskRows and notFunc are all zero -> the XOR term vanishes and the matrix is evaluated as-is
  return evaluatePenalty(
    matrix.modules,
    size,
    new Uint8Array(size * size),
    new Uint8Array(12 * size),
  );
}

/* ------------------------------------------------------------------ */
/* Drawing function patterns                                            */
/* ------------------------------------------------------------------ */

function setFunction(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  x: number,
  y: number,
  dark: number,
): void {
  const idx = y * size + x;
  modules[idx] = dark;
  isFunction[idx] = 1;
}

/** Draws the three 7x7 finder patterns plus separators in the corners. */
function drawFinderPatterns(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
): void {
  const corners: readonly [number, number][] = [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ];
  for (const [cx, cy] of corners) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        // Chebyshev distance from center: 0-1 = dark, 2 = light, 3 = dark, 4 = separator (light)
        setFunction(modules, isFunction, size, x, y, dist !== 2 && dist !== 4 ? 1 : 0);
      }
    }
  }
}

/** Timing patterns (alternating modules along row 6 and column 6). */
function drawTimingPatterns(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
): void {
  for (let i = 8; i < size - 8; i++) {
    const dark = (i & 1) === 0 ? 1 : 0;
    setFunction(modules, isFunction, size, i, 6, dark);
    setFunction(modules, isFunction, size, 6, i, dark);
  }
}

/** 5x5 alignment patterns, skipping the three corners occupied by finders. */
function drawAlignmentPatterns(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  version: number,
): void {
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0)
      ) {
        continue;
      }
      const cx = positions[j]!;
      const cy = positions[i]!;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setFunction(modules, isFunction, size, cx + dx, cy + dy, dist !== 1 ? 1 : 0);
        }
      }
    }
  }
}

/**
 * Draws the 15 format info bits in both locations (dark module included).
 * Bits are placed LSB first. During mask auto-selection this is redrawn
 * for each candidate.
 */
function drawFormatBits(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  bits: number,
): void {
  const bit = (i: number) => (bits >> i) & 1;
  // First copy (top-left, in an L shape avoiding the timing patterns)
  for (let i = 0; i <= 5; i++) setFunction(modules, isFunction, size, 8, i, bit(i));
  setFunction(modules, isFunction, size, 8, 7, bit(6));
  setFunction(modules, isFunction, size, 8, 8, bit(7));
  setFunction(modules, isFunction, size, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFunction(modules, isFunction, size, 14 - i, 8, bit(i));
  // Second copy (row 8 at the top right + column 8 at the bottom left)
  for (let i = 0; i < 8; i++) setFunction(modules, isFunction, size, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFunction(modules, isFunction, size, 8, size - 15 + i, bit(i));
  // Dark module (always dark)
  setFunction(modules, isFunction, size, 8, size - 8, 1);
}

/** Draws the 18 version info bits in both blocks (3x6 top-right, 6x3 bottom-left) for v7+. */
function drawVersionBits(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  version: number,
): void {
  if (version < 7) return;
  const bits = versionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = (bits >> i) & 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunction(modules, isFunction, size, a, b, bit); // top-right
    setFunction(modules, isFunction, size, b, a, bit); // bottom-left
  }
}

/* ------------------------------------------------------------------ */
/* Data placement and mask application                                  */
/* ------------------------------------------------------------------ */

/**
 * Places the codewords in a zigzag over 2-column strips from the bottom
 * right, skipping column 6 (timing). Remainder bits (0/3/4/7 depending on
 * the version) stay light (0). Throws on internal inconsistency, i.e. when
 * the number of placed bits differs from codewords x 8.
 */
function placeData(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  data: Uint8Array,
): void {
  const totalBits = data.length * 8;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      const rowBase = y * size;
      for (let j = 0; j < 2; j++) {
        const idx = rowBase + right - j;
        if (isFunction[idx] === 0 && i < totalBits) {
          modules[idx] = (data[i >> 3]! >> (7 - (i & 7))) & 1;
          i++;
        }
      }
    }
  }
  if (i !== totalBits) {
    throw new Error(`placeData: placed ${i} bits, expected ${totalBits}`);
  }
}

/** XOR-applies a mask to the data modules (function patterns excluded). */
function applyMask(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  maskTable: Uint8Array,
): void {
  for (let y = 0; y < size; y++) {
    const rowBase = y * size;
    const maskRowBase = (y % 12) * 12;
    for (let x = 0; x < size; x++) {
      const idx = rowBase + x;
      if (isFunction[idx] === 0) {
        modules[idx] = modules[idx]! ^ maskTable[maskRowBase + (x % 12)]!;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Matrix construction                                                  */
/* ------------------------------------------------------------------ */

/**
 * Builds the finished QR matrix from a codeword sequence.
 *
 * @param codewords the interleaved codeword sequence from buildCodewords
 * @param mask -1 for auto-selection (lowest penalty), 0-7 to force a mask
 */
export function buildMatrix(
  codewords: Uint8Array,
  version: number,
  ecLevel: ECLevel,
  mask = -1,
): QRMatrix {
  if (!Number.isInteger(mask) || mask < -1 || mask > 7) {
    throw new RangeError(`invalid mask: ${mask}`);
  }
  const capacity = getCapacity(version, ecLevel);
  if (codewords.length !== capacity.totalCodewords) {
    throw new RangeError(
      `buildMatrix: expected ${capacity.totalCodewords} codewords, got ${codewords.length}`,
    );
  }

  const size = version * 4 + 17;
  const modules = new Uint8Array(size * size);
  const isFunction = new Uint8Array(size * size);

  drawFinderPatterns(modules, isFunction, size);
  drawTimingPatterns(modules, isFunction, size);
  drawAlignmentPatterns(modules, isFunction, size, version);
  drawFormatBits(modules, isFunction, size, formatBits(ecLevel, 0)); // reserve the area
  drawVersionBits(modules, isFunction, size, version);
  placeData(modules, isFunction, size, codewords);

  let chosenMask = mask;
  if (chosenMask === -1) {
    // Evaluate each candidate with its own format info drawn in
    const notFunc = isFunction.map((v) => v ^ 1);
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      drawFormatBits(modules, isFunction, size, formatBits(ecLevel, m));
      const score = evaluatePenalty(
        modules,
        size,
        notFunc,
        expandMaskRows(MASK_TABLES[m]!, size),
      );
      if (score < bestScore) {
        bestScore = score;
        chosenMask = m;
      }
    }
  }

  drawFormatBits(modules, isFunction, size, formatBits(ecLevel, chosenMask));
  applyMask(modules, isFunction, size, MASK_TABLES[chosenMask]!);

  return { size, version, ecLevel, mask: chosenMask, modules };
}
