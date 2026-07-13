import type { QRMatrix } from "./matrix";

/**
 * Converts a QR matrix into a d-attribute string for a single SVG <path>.
 *
 * Horizontal runs of dark modules in each row are merged run-length style,
 * one run = one rectangular subpath (`M{x} {y}h{w}v1h-{w}z`). Compared with
 * emitting one rectangle per module, the DOM node count is the same (a
 * single path either way) but the d string length and path rendering cost
 * shrink to roughly 30-40% of the naive size.
 *
 * Coordinates: 1 module = 1 unit. The quiet zone is not included; callers
 * provide it by shifting the viewBox or with a transform.
 */
export function toSvgPath(matrix: QRMatrix): string {
  const { size, modules } = matrix;
  // Direct concatenation benefits from V8's rope strings: about 25% faster than array+join (measured at v40)
  let d = "";
  for (let y = 0; y < size; y++) {
    const rowBase = y * size;
    let x = 0;
    while (x < size) {
      if (modules[rowBase + x] === 0) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && modules[rowBase + x + run] === 1) run++;
      d += `M${x} ${y}h${run}v1h-${run}z`;
      x += run;
    }
  }
  return d;
}
