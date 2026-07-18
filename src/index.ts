/**
 * react-qr-lite — root entry (React component + core API).
 * When not using React, import "react-qr-lite/core" directly to avoid any
 * dependency on react/jsx-runtime.
 */
export { QRCode } from "./QRCode";
export type { QRCodeProps } from "./QRCode";
export { chooseVersion, detectMode, encode, getModule, toSvgPath } from "./core";
export type { DetectModeOptions, ECLevel, EncodeOptions, Mode, QRMatrix } from "./core";
