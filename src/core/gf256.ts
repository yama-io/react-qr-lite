/**
 * GF(256) — finite field arithmetic used by Reed-Solomon error correction
 * in QR codes (ISO/IEC 18004).
 *
 * Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x11D), generator α = 2.
 *
 * Design notes:
 * - Tables are generated at module load rather than embedded in the source
 *   (smaller bundle). Generation is a single 255-iteration loop, measured
 *   at well under one microsecond.
 * - The EXP table is duplicated out to 510 entries so multiplication can
 *   skip the `% 255` (log a + log b is at most 508, which stays in range).
 * - Uint8Array and integer arithmetic only; no object allocation on hot paths.
 */

/** The primitive polynomial specified for QR codes: x^8 + x^4 + x^3 + x^2 + 1 */
export const PRIMITIVE_POLYNOMIAL = 0x11d;

/** EXP[i] = α^i (i = 0..509; entries from 255 onward repeat the period) */
const EXP = new Uint8Array(510);
/** LOG[a] = log_α(a) (a = 1..255; LOG[0] is undefined and must never be read) */
const LOG = new Uint8Array(256);

// Generate the tables once at module load
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE_POLYNOMIAL;
  }
  for (let i = 255; i < 510; i++) {
    EXP[i] = EXP[i - 255]!;
  }
}

/**
 * Addition (= subtraction) in GF(256): plain XOR.
 * Wrapped as a function for readability; hot paths may write `a ^ b` directly.
 */
export function add(a: number, b: number): number {
  return a ^ b;
}

/** Returns α^i for any non-negative integer i (mod 255 internally). */
export function exp(i: number): number {
  return EXP[i % 255]!;
}

/**
 * Returns log_α(a).
 * @throws {RangeError} when a === 0 (log 0 is undefined)
 */
export function log(a: number): number {
  if (a === 0) throw new RangeError("GF(256): log(0) is undefined");
  return LOG[a]!;
}

/** Multiplication in GF(256). */
export function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  // LOG[a] + LOG[b] <= 254 + 254 = 508 < 510, so no mod is needed
  return EXP[LOG[a]! + LOG[b]!]!;
}

/**
 * Division a / b in GF(256).
 * @throws {RangeError} when b === 0
 */
export function div(a: number, b: number): number {
  if (b === 0) throw new RangeError("GF(256): division by zero");
  if (a === 0) return 0;
  return EXP[LOG[a]! - LOG[b]! + 255]!;
}

/**
 * Exponentiation a^n in GF(256) (n >= 0).
 * Defines 0^0 = 1 (this case never occurs in RS computation).
 */
export function pow(a: number, n: number): number {
  if (n === 0) return 1;
  if (a === 0) return 0;
  return EXP[(LOG[a]! * n) % 255]!;
}

/**
 * Multiplicative inverse a^-1 in GF(256).
 * @throws {RangeError} when a === 0
 */
export function inv(a: number): number {
  if (a === 0) throw new RangeError("GF(256): 0 has no multiplicative inverse");
  return EXP[255 - LOG[a]!]!;
}

/**
 * Polynomial multiplication (coefficients in GF(256); addition is XOR).
 * Coefficients are ordered from the highest degree: [a, b, c] = a·x^2 + b·x + c
 *
 * Used to build Reed-Solomon generator polynomials. Not a hot path, so a
 * straightforward O(n·m) implementation is fine.
 */
export function polyMul(p: Uint8Array, q: Uint8Array): Uint8Array {
  const result = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]!;
    if (pi === 0) continue;
    for (let j = 0; j < q.length; j++) {
      result[i + j] = result[i + j]! ^ mul(pi, q[j]!);
    }
  }
  return result;
}

/**
 * Returns the Reed-Solomon generator polynomial
 * g(x) = (x - α^0)(x - α^1)...(x - α^(degree-1)).
 * In GF(256) subtraction is XOR (= addition), so (x - α^i) = (x + α^i).
 *
 * The result is a coefficient array ordered from the highest degree
 * (length degree + 1, leading coefficient always 1). Results are cached per
 * degree, since QR generation reuses the same degrees repeatedly.
 */
const generatorPolyCache = new Map<number, Uint8Array>();

export function rsGeneratorPoly(degree: number): Uint8Array {
  const cached = generatorPolyCache.get(degree);
  if (cached) return cached;

  let g: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    g = polyMul(g, new Uint8Array([1, EXP[i]!]));
  }
  generatorPolyCache.set(degree, g);
  return g;
}
