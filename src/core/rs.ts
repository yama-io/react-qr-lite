import { exp, log, rsGeneratorPoly } from "./gf256";

/**
 * Caches the generator polynomial converted to the log domain, per degree.
 * logGen[j] = log(gen[j+1]) (the monic leading coefficient gen[0]=1 is dropped).
 *
 * QR generator polynomials are known to have all-nonzero coefficients, but as
 * a safeguard, zero coefficients are represented by a sentinel (-1) and
 * skipped in the division loop.
 */
const logGenCache = new Map<number, Int16Array>();

function logGeneratorPoly(degree: number): Int16Array {
  const cached = logGenCache.get(degree);
  if (cached) return cached;

  const gen = rsGeneratorPoly(degree);
  const logGen = new Int16Array(degree);
  for (let j = 0; j < degree; j++) {
    const g = gen[j + 1]!;
    logGen[j] = g === 0 ? -1 : log(g);
  }
  logGenCache.set(degree, logGen);
  return logGen;
}

/**
 * Generates Reed-Solomon error correction codewords.
 *
 * For a data polynomial d(x), returns the coefficients of the remainder r(x)
 * of d(x)·x^ecLength divided by the generator polynomial g(x). In QR codes
 * this remainder is used directly as the error correction codewords (the
 * transmitted polynomial d(x)·x^k + r(x) is divisible by g(x)).
 *
 * The implementation is a one-pass O(data.length × ecLength) synthetic
 * division: the remainder register shifts left one byte at a time while the
 * product of the leading coefficient factor = data[i] ^ reg[0] and the
 * generator polynomial is folded in via XOR. The log of factor is computed
 * once per outer iteration, so the inner loop is only
 * "log addition + EXP table lookup + XOR".
 *
 * @param data Data codewords (one block)
 * @param ecLength Number of error correction codewords (= generator degree, >= 1)
 * @returns Error correction codewords of length ecLength
 * @throws {RangeError} when ecLength is not a positive integer
 */
export function rsEncode(data: Uint8Array, ecLength: number): Uint8Array {
  if (!Number.isInteger(ecLength) || ecLength < 1) {
    throw new RangeError(`rsEncode: invalid ecLength: ${ecLength}`);
  }

  const logGen = logGeneratorPoly(ecLength);
  const reg = new Uint8Array(ecLength);
  const last = ecLength - 1;

  for (let i = 0; i < data.length; i++) {
    const factor = data[i]! ^ reg[0]!;

    // Shift the register left by one (drop the head, append a zero)
    reg.copyWithin(0, 1);
    reg[last] = 0;

    if (factor !== 0) {
      const logFactor = log(factor);
      for (let j = 0; j < ecLength; j++) {
        const lg = logGen[j]!;
        if (lg >= 0) {
          reg[j] = reg[j]! ^ exp(lg + logFactor);
        }
      }
    }
  }
  return reg;
}
