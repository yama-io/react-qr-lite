# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-18

### Added

- `allowKanji` option on `encode` / `chooseVersion` (and as a `<QRCode />`
  prop), default `true`. Setting it to `false` excludes Kanji mode from
  automatic mode detection, so all-double-byte strings are always encoded in
  Byte mode (UTF-8). Kanji detection depends on the runtime's
  `TextDecoder("shift_jis")` support; pinning it off makes the generated
  symbol byte-for-byte identical across environments — use this when server
  and client runtimes may differ (e.g. edge-runtime SSR hydrated in a
  browser), where the automatic Kanji/Byte fallback could otherwise cause a
  hydration mismatch. The `DetectModeOptions` type is exported, and
  `detectMode` accepts the same option.

### Tests

- RSC smoke test: `<QRCode />` is rendered through the Flight renderer
  (`react-server-dom-turbopack`) in a process with Node's `react-server`
  export condition enabled, proving the component works inside React Server
  Components without a `"use client"` directive (it uses only
  `useMemo`/`forwardRef`, which exist in React's server subset). Runs as a
  second vitest config (`vitest.rsc.config.ts`) chained into `npm test`.

## [1.0.0] - 2026-07-17

First stable release. From this version on, the exported API is covered by
the SemVer contract. The exact module pattern produced for a given input is
not — encoder improvements may change it in minor releases; what is
guaranteed is a valid, scannable symbol.

### Added

- Inputs that cannot fit any QR version are rejected up front, before any
  O(n) encoding work: strings longer than 7,089 UTF-16 code units and byte
  arrays longer than 2,953 bytes now throw immediately.
- Documentation site at <https://yama-io.github.io/react-qr-lite/> (guide,
  API reference, live playground), deployed from `docs/` via GitHub Pages.

### Documentation

- README: documented the Byte-mode text-encoding policy (UTF-8 without an
  ECI header), the `mask` prop shadowing the SVG attribute (use
  `style={{ mask: ... }}` for CSS masking), the output-stability policy, and
  the Node.js requirement.

### Tests

- Full round-trip sweep: all 40 versions × 4 error correction levels are
  encoded and decoded back with jsQR. One combination (v23-L) is skipped
  because jsQR's version table has a typo in v23's alignment-pattern centers
  (74 instead of the spec's 78); the encoder output for it was verified
  against a corrected jsQR copy.
- A surface-lock test pins the exact list of public core exports.
