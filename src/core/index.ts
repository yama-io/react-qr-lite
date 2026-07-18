/**
 * Public API of react-qr-lite/core.
 *
 * Only what is re-exported here is public. The internal pipeline modules
 * (segments, codewords, rs/gf256, matrix internals, sjis, bitbuffer) are
 * implementation details: they are not reachable from the published package
 * (the exports map exposes only this entry) and are free to change between
 * releases.
 */
export { encode, chooseVersion } from "./encode";
export type { EncodeOptions } from "./encode";
export { detectMode } from "./segments";
export type { DetectModeOptions, Mode } from "./segments";
export type { ECLevel } from "./capacity";
export { getModule } from "./matrix";
export type { QRMatrix } from "./matrix";
export { toSvgPath } from "./svgpath";

// TODO: multi-segment splitting optimization (carving digit runs into Numeric segments, etc.)
