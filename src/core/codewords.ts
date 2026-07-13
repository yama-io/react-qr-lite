import { BitBuffer } from "./bitbuffer";
import {
  assertVersion,
  getCapacity,
  type Capacity,
  type ECLevel,
} from "./capacity";
import { rsEncode } from "./rs";
import { totalBits, writeSegment, type Segment } from "./segments";

/**
 * Codeword construction — the layer that turns a segment list into the final
 * transmitted codeword sequence (data + error correction, block-interleaved).
 *
 * Steps:
 * 1. Serialize the segments into a bit stream
 * 2. Terminator (up to 4 zero bits) -> zero-pad to a byte boundary -> pad
 *    codewords (0xEC, 0x11)
 * 3. Split the data codewords into blocks (short blocks first)
 * 4. Compute each block's Reed-Solomon error correction codewords
 * 5. Interleave data and EC byte by byte across blocks
 */

/** Pad codewords (the alternating pattern 11101100 / 00010001 defined by the spec) */
const PAD0 = 0xec;
const PAD1 = 0x11;

/**
 * Returns the smallest version that can hold the segment list.
 *
 * The character count indicator width changes across version bands
 * (1-9 / 10-26 / 27-40), so the required bit length is evaluated per version.
 *
 * @param minVersion version to start searching from (default 1)
 * @throws {RangeError} when minVersion is not an integer 1-40
 * @throws {Error} when the data does not fit even at version 40
 */
export function chooseVersion(
  segments: readonly Segment[],
  ecLevel: ECLevel,
  minVersion = 1,
): number {
  assertVersion(minVersion);
  for (let v = minVersion; v <= 40; v++) {
    const capacityBits = getCapacity(v, ecLevel).dataCodewords * 8;
    if (totalBits(segments, v) <= capacityBits) return v;
  }
  throw new Error(
    `chooseVersion: data too long for any version at level ${ecLevel}`,
  );
}

/**
 * Serializes a segment list into the data codeword sequence
 * (padding included, before block splitting).
 * @throws {Error} when the data does not fit the given version/level capacity
 */
export function buildDataCodewords(
  segments: readonly Segment[],
  capacity: Capacity,
): Uint8Array {
  const capacityBits = capacity.dataCodewords * 8;
  const buf = new BitBuffer(capacity.dataCodewords);

  for (const seg of segments) {
    writeSegment(buf, seg, capacity.version);
  }
  if (buf.length > capacityBits) {
    throw new Error(
      `buildDataCodewords: data (${buf.length} bits) exceeds capacity ` +
        `(${capacityBits} bits) at version ${capacity.version}-${capacity.ecLevel}`,
    );
  }

  // Terminator: four zero bits (fewer if less capacity remains)
  buf.put(0, Math.min(4, capacityBits - buf.length));
  // Zero-pad to a byte boundary
  const rem = buf.length & 7;
  if (rem !== 0) buf.put(0, 8 - rem);
  // Alternate pad codewords until full
  for (let p = 0; buf.length < capacityBits; p ^= 1) {
    buf.put(p === 0 ? PAD0 : PAD1, 8);
  }
  return buf.toUint8Array();
}

/**
 * Splits the data codewords into blocks, computes each block's EC, and
 * returns the interleaved final codeword sequence.
 *
 * Short blocks (numShortBlocks of them) come first. Interleaving takes one
 * byte per block, column by column; short blocks have no data in the final
 * column and are skipped there (as ISO/IEC 18004 prescribes).
 *
 * @param data data codeword sequence of length capacity.dataCodewords
 */
export function assembleCodewords(
  data: Uint8Array,
  capacity: Capacity,
): Uint8Array {
  const { dataCodewords, totalCodewords, ecPerBlock, numBlocks, numShortBlocks, shortBlockDataLen } =
    capacity;
  if (data.length !== dataCodewords) {
    throw new RangeError(
      `assembleCodewords: expected ${dataCodewords} data codewords, got ${data.length}`,
    );
  }

  // Block split + EC computation
  const blocks: Uint8Array[] = new Array(numBlocks);
  const ecBlocks: Uint8Array[] = new Array(numBlocks);
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = shortBlockDataLen + (b < numShortBlocks ? 0 : 1);
    const block = data.subarray(offset, offset + len);
    offset += len;
    blocks[b] = block;
    ecBlocks[b] = rsEncode(block, ecPerBlock);
  }

  // Interleave
  const result = new Uint8Array(totalCodewords);
  let k = 0;
  const longBlockDataLen =
    shortBlockDataLen + (numShortBlocks < numBlocks ? 1 : 0);
  for (let col = 0; col < longBlockDataLen; col++) {
    for (let b = 0; b < numBlocks; b++) {
      const block = blocks[b]!;
      if (col < block.length) result[k++] = block[col]!;
    }
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (let b = 0; b < numBlocks; b++) {
      result[k++] = ecBlocks[b]![col]!;
    }
  }
  return result;
}

/**
 * Builds the final codeword sequence from a segment list — the exact byte
 * sequence that gets placed into the matrix.
 */
export function buildCodewords(
  segments: readonly Segment[],
  version: number,
  ecLevel: ECLevel,
): Uint8Array {
  const capacity = getCapacity(version, ecLevel);
  return assembleCodewords(buildDataCodewords(segments, capacity), capacity);
}
