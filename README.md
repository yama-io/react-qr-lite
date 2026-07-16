# react-qr-lite

Fast, tiny QR code generator for React, rendered as SVG. Zero dependencies.

The encoder is a from-scratch implementation of ISO/IEC 18004 — no wrapper around an existing library. The framework-agnostic core is 4.48 KB (minified + brotli) and can be used without React.

[![npm](https://img.shields.io/npm/v/react-qr-lite)](https://www.npmjs.com/package/react-qr-lite)
[![CI](https://github.com/yama-io/react-qr-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/yama-io/react-qr-lite/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/react-qr-lite)](./LICENSE)

## Features

- **Tiny** — 4.48 KB core, size-limit enforced (5 KB core / 6 KB with the React component). Lookup tables are computed at runtime instead of shipped in the bundle.
- **Fast** — a typical URL encodes in ~0.2 ms with automatic mask selection (~24 µs with a fixed mask).
- **Minimal DOM** — all dark modules are drawn as a single run-length-compressed `<path>`; the whole component is 3 DOM nodes (`svg` / `rect` / `path`).
- **Full encoder** — Numeric / Alphanumeric / Byte (UTF-8) / Kanji modes with automatic mode detection, versions 1–40, all four error correction levels, automatic mask selection, verified end-to-end by decoding the output with [jsQR](https://github.com/cozmo/jsQR) across all 40 versions × 4 EC levels.
- **Framework-agnostic core** — import `react-qr-lite/core` to get just the encoder, with no dependency on React.
- **TypeScript native** — strict types, ESM + CJS builds.

## Installation

```bash
npm install react-qr-lite
```

React ≥ 17 is an optional peer dependency — only needed if you use the `<QRCode />` component. Server-side use requires Node.js ≥ 18; in the browser any ES2020 runtime works.

## Usage

```tsx
import { QRCode } from "react-qr-lite";

<QRCode value="https://example.com" />

<QRCode
  value="https://example.com"
  ecLevel="H"
  size={256}
  fgColor="#1a3c8f"
  bgColor="transparent"
  title="Link to example.com"
/>
```

### Responsive sizing

With `responsive`, the SVG fills its container's width and stays square via the viewBox's intrinsic 1:1 ratio. Cap it with `maxWidth`:

```tsx
<div style={{ width: "100%", maxWidth: 320 }}>
  <QRCode value="https://example.com" responsive />
</div>
```

### Without React

The core encoder is exposed as a subpath export and pulls in nothing from React:

```ts
import { encode, toSvgPath } from "react-qr-lite/core";

const matrix = encode("https://example.com", { ecLevel: "M" });
const d = toSvgPath(matrix); // ready to use as <path d={d}>
```

`encode` returns a `QRMatrix` (`{ size, modules, version, ecLevel, mask }` with a row-major flat `Uint8Array` of modules), so you can also render to canvas, a terminal, or anything else.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string \| Uint8Array` | — | Content to encode. Strings get automatic mode detection (Numeric / Alphanumeric / Kanji / Byte); a `Uint8Array` always uses Byte mode. |
| `size` | `number \| string` | `128` | Rendered size. A number is pixels; a string is passed through as a CSS length (`"20rem"`, `"50vw"`). Ignored when `responsive` is set. |
| `responsive` | `boolean` | `false` | Fill the container's width, keeping a 1:1 aspect ratio. Overrides `size`. |
| `ecLevel` | `"L" \| "M" \| "Q" \| "H"` | `"M"` | Error correction level. |
| `margin` | `number` | `4` | Quiet zone width in modules (the spec recommends 4). |
| `fgColor` | `string` | `"#000000"` | Foreground (module) color. |
| `bgColor` | `string` | `"#FFFFFF"` | Background color. `"transparent"` is allowed. |
| `title` | `string` | — | Accessible `<title>` for the SVG. |
| `version` | `number` | auto | Pin the symbol version (1–40). Defaults to the smallest version that fits. |
| `minVersion` | `number` | `1` | Lower bound for automatic version selection. |
| `mask` | `number` | auto | Mask pattern 0–7. Auto-selects the lowest-penalty mask by default. |

All other props are spread onto the `<svg>` element, and `ref` is forwarded to it.

Notes:

- The SVG has `role="img"`, so give it an accessible name: pass `title` (or `aria-label`) so screen readers can announce what the code links to. For purely decorative codes, pass `aria-hidden` instead.
- Encoding runs inside `useMemo` and recomputes only when `value` or the encoding options change. When passing a `Uint8Array`, keep the reference stable across renders to avoid re-encoding.
- If the value cannot be encoded (e.g. too long for version 40), `encode` throws — catch it with an Error Boundary.
- The `mask` prop selects the QR mask pattern and shadows the SVG `mask` attribute. To apply a CSS mask to the element, use `style={{ mask: ... }}`.
- The exact module pattern produced for a given input may change between minor versions as the encoder improves (e.g. better segmentation). What is guaranteed is a valid, scannable symbol — don't snapshot the pixels across upgrades.

## Text encoding

Strings are encoded as UTF-8 in Byte mode, without an ECI header. Strictly speaking the spec's default Byte-mode charset is ISO 8859-1, but ECI-less UTF-8 is the de facto standard that every modern reader (ZXing, iOS, Android) assumes — and an explicit ECI header actually breaks some older scanners.

Strings consisting entirely of Shift-JIS double-byte characters are encoded in Kanji mode instead (13 bits per character instead of UTF-8 bytes). The Unicode→Shift-JIS mapping is built at runtime from the platform's native `TextDecoder("shift_jis")` rather than shipping a conversion table (~0.4 KB of code, ~5 ms one-time cost). On runtimes without Shift-JIS support, encoding falls back to Byte mode (UTF-8) automatically — the result is always a valid, scannable QR code.

## Bundle size

Measured at v1.0.0. `react` is a peer dependency and is excluded from all measurements.

| Entry | Tool / bundler | Compression | Size |
| --- | --- | --- | --- |
| `react-qr-lite/core` (encoder only) | size-limit (esbuild) | Brotli | 4.48 KB |
| `react-qr-lite` (with `<QRCode />`) | size-limit (esbuild) | Brotli | 5.00 KB |
| `react-qr-lite` | [Bundlephobia](https://bundlephobia.com/package/react-qr-lite) (webpack) | Gzip | 5.31 KB (v0.1.0) |

The size-limit numbers are enforced budgets (5 KB core / 6 KB full) — `npm publish` fails if a change exceeds them. Bundlephobia reports a slightly larger number because it measures only the root entry, bundles with webpack (which adds a small runtime wrapper), and compresses with gzip instead of brotli. What your users actually download depends on your CDN: brotli-capable servers deliver close to the size-limit figures.

## Development

```bash
npm install
npm test            # run the test suite (vitest)
npm run build       # build ESM + CJS + type declarations into dist/
npm run size        # check bundle size budgets (size-limit)
npm run typecheck
```

## License

[MIT](./LICENSE)
