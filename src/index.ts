/**
 * react-qr-lite — root entry (React component + core API).
 * When not using React, import "react-qr-lite/core" directly to avoid any
 * dependency on react/jsx-runtime.
 */
export { QRCode } from "./QRCode";
export type { QRCodeProps } from "./QRCode";
export { encode, toSvgPath, getModule, penaltyScore } from "./core";
export type { ECLevel, EncodeOptions, QRMatrix } from "./core";
