import { describe, expect, it } from "vitest";
import { encode } from "./encode";
import type { QRMatrix } from "./matrix";
import { toSvgPath } from "./svgpath";

function makeMatrix(size: number, rows: string[]): QRMatrix {
  const modules = new Uint8Array(size * size);
  rows.forEach((row, y) => {
    for (let x = 0; x < size; x++) modules[y * size + x] = row.charCodeAt(x) - 48;
  });
  return { size, version: 1, ecLevel: "M", mask: 0, modules };
}

describe("toSvgPath", () => {
  it("run lengths are correct for a small known pattern", () => {
    const m = makeMatrix(3, [
      "101", //
      "111",
      "000",
    ]);
    expect(toSvgPath(m)).toBe("M0 0h1v1h-1zM2 0h1v1h-1zM0 1h3v1h-3z");
  });

  it("all-light matrix yields an empty string", () => {
    expect(toSvgPath(makeMatrix(2, ["00", "00"]))).toBe("");
  });

  it("rebuilding a real QR from the path reproduces the original matrix (invertibility)", () => {
    for (const [text, opts] of [
      ["INVERSE PARSE", {}],
      ["https://example.com/x?y=1", { ecLevel: "H" as const }],
      ["12345678901234567890", { version: 7 }],
    ] as const) {
      const matrix = encode(text, opts);
      const d = toSvgPath(matrix);
      const rebuilt = new Uint8Array(matrix.size * matrix.size);
      let matchedLen = 0;
      for (const [, xs, ys, ws, wb] of d.matchAll(
        /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g,
      )) {
        const x = Number(xs);
        const y = Number(ys);
        const w = Number(ws);
        expect(Number(wb)).toBe(w); // the return horizontal width matches the outbound one
        for (let i = 0; i < w; i++) rebuilt[y * matrix.size + x + i] = 1;
        matchedLen += 8 + xs!.length + ys!.length + ws!.length + wb!.length;
      }
      expect(matchedLen, "the whole d string consists of repeated subpath patterns").toBe(d.length);
      expect(rebuilt).toEqual(matrix.modules);
    }
  });

  it("runs are merged (adjacent dark modules do not become separate subpaths)", () => {
    // On a real QR containing a timing row (alternating) and finder top edges
    // (runs of 7), confirm subpath count < dark module count
    const matrix = encode("RUN LENGTH");
    const d = toSvgPath(matrix);
    const subpaths = d.match(/M/g)!.length;
    let dark = 0;
    for (const b of matrix.modules) dark += b;
    expect(subpaths).toBeLessThan(dark * 0.6);
  });
});
