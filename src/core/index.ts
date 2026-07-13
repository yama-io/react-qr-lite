export { rsEncode } from "./rs";
export { BitBuffer } from "./bitbuffer";
export {
  ALPHANUMERIC_CHARSET,
  MODE_INDICATOR,
  ccBits,
  detectMode,
  makeAlphanumericSegment,
  makeByteSegment,
  makeKanjiSegment,
  makeNumericSegment,
  makeSegments,
  segmentBits,
  totalBits,
  writeSegment,
} from "./segments";
export type { Mode, Segment } from "./segments";
export { kanjiModeAvailable } from "./sjis";
export { EC_LEVELS, getCapacity, totalCodewords } from "./capacity";
export type { Capacity, ECLevel } from "./capacity";
export {
  assembleCodewords,
  buildCodewords,
  buildDataCodewords,
  chooseVersion,
} from "./codewords";
export {
  alignmentPositions,
  buildMatrix,
  formatBits,
  getModule,
  penaltyScore,
  versionBits,
} from "./matrix";
export type { QRMatrix } from "./matrix";
export { toSvgPath } from "./svgpath";
export { encode } from "./encode";
export type { EncodeOptions } from "./encode";

// TODO: multi-segment splitting optimization (carving digit runs into Numeric segments, etc.)
