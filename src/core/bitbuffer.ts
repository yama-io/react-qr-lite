/**
 * BitBuffer — a growable bit stream used by QR data encoding.
 *
 * Bits are packed MSB-first (from the high bit of each byte).
 * QR encoding (4-bit mode indicator, 8-16 bit character count indicator,
 * then the payload) is a sequence of "write value with a given bit width"
 * operations, and this class makes those fast.
 *
 * Design notes:
 * - Backed by a Uint8Array; capacity doubles when exhausted (amortized O(1))
 * - Writes work in byte-boundary chunks rather than one bit at a time
 * - No object allocation on hot paths
 */
export class BitBuffer {
  private bytes: Uint8Array;
  private bitLength = 0;

  /**
   * @param initialByteCapacity Initial capacity in bytes. QR's maximum data
   *   capacity is roughly 2956 bytes, but the default is kept small to suit
   *   typical inputs.
   */
  constructor(initialByteCapacity = 64) {
    this.bytes = new Uint8Array(Math.max(1, initialByteCapacity));
  }

  /** Current length in bits */
  get length(): number {
    return this.bitLength;
  }

  /** Current length rounded up to whole bytes */
  get byteLength(): number {
    return (this.bitLength + 7) >> 3;
  }

  /**
   * Writes the low numBits bits of value (MSB-first).
   *
   * @param value Non-negative integer; must fit in numBits bits
   * @param numBits 0-30
   * @throws {RangeError} when numBits is out of range or value does not fit
   */
  put(value: number, numBits: number): void {
    if (numBits < 0 || numBits > 30) {
      throw new RangeError(`BitBuffer: numBits out of range: ${numBits}`);
    }
    if (value < 0 || value >>> numBits !== 0) {
      throw new RangeError(
        `BitBuffer: value ${value} does not fit in ${numBits} bits`,
      );
    }
    this.ensureCapacity(this.bitLength + numBits);

    const bytes = this.bytes;
    let remaining = numBits;
    let pos = this.bitLength;
    while (remaining > 0) {
      const byteIndex = pos >> 3;
      const free = 8 - (pos & 7); // free bits remaining in the current byte
      const take = free < remaining ? free : remaining;
      const chunk = (value >>> (remaining - take)) & ((1 << take) - 1);
      bytes[byteIndex] = bytes[byteIndex]! | (chunk << (free - take));
      pos += take;
      remaining -= take;
    }
    this.bitLength = pos;
  }

  /** Writes a single bit. */
  putBit(bit: 0 | 1 | boolean): void {
    this.ensureCapacity(this.bitLength + 1);
    if (bit) {
      const pos = this.bitLength;
      this.bytes[pos >> 3] = this.bytes[pos >> 3]! | (0x80 >>> (pos & 7));
    }
    this.bitLength++;
  }

  /**
   * Writes a byte array in bulk.
   * When the current position is byte-aligned, copies at once via set().
   */
  putBytes(data: Uint8Array): void {
    if ((this.bitLength & 7) === 0) {
      const byteIndex = this.bitLength >> 3;
      this.ensureCapacity(this.bitLength + data.length * 8);
      this.bytes.set(data, byteIndex);
      this.bitLength += data.length * 8;
    } else {
      for (let i = 0; i < data.length; i++) {
        this.put(data[i]!, 8);
      }
    }
  }

  /**
   * Returns the bit at index (0-based) as 0 | 1.
   * @throws {RangeError} when out of range
   */
  getBit(index: number): 0 | 1 {
    if (index < 0 || index >= this.bitLength) {
      throw new RangeError(`BitBuffer: bit index out of range: ${index}`);
    }
    return ((this.bytes[index >> 3]! >>> (7 - (index & 7))) & 1) as 0 | 1;
  }

  /**
   * Returns a copy of the contents (byteLength bytes).
   * Unused bits in the final byte are 0.
   */
  toUint8Array(): Uint8Array {
    return this.bytes.slice(0, this.byteLength);
  }

  private ensureCapacity(bits: number): void {
    const needed = (bits + 7) >> 3;
    if (needed <= this.bytes.length) return;
    let cap = this.bytes.length * 2;
    while (cap < needed) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.bytes);
    this.bytes = next;
  }
}
