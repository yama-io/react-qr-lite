import { forwardRef, useMemo, type SVGProps } from "react";
import { encode } from "./core/encode";
import type { ECLevel } from "./core/capacity";
import { toSvgPath } from "./core/svgpath";

/**
 * Props for <QRCode />.
 * Anything not listed here is passed through to the <svg> element
 * (spread last, so defaults such as width or role can be overridden).
 */
export interface QRCodeProps
  extends Omit<
    SVGProps<SVGSVGElement>,
    "children" | "title" | "version" | "mask"
  > {
  /** Content to encode. Strings get automatic mode detection; Uint8Array uses Byte mode */
  value: string | Uint8Array;
  /**
   * Rendered size. A number is treated as pixels; a string is passed through
   * as a CSS length (e.g. "20rem", "50vw"). Default 128. Ignored when
   * `responsive` is set.
   */
  size?: number | string | undefined;
  /**
   * Scale to fill the container's width, deriving height from the square
   * viewBox so the code stays a 1:1 square. Overrides `size`. Cap it with a
   * `style={{ maxWidth: ... }}` if you want an upper bound.
   */
  responsive?: boolean | undefined;
  /** Error correction level (default "M") */
  ecLevel?: ECLevel | undefined;
  /** Pin the version (defaults to the smallest version that fits) */
  version?: number | undefined;
  /** Minimum version for auto-selection */
  minVersion?: number | undefined;
  /** Mask number 0-7 (auto-selected by default) */
  mask?: number | undefined;
  /**
   * Quiet zone width in modules (default 4, the spec's recommendation).
   * Must be a non-negative finite number.
   */
  margin?: number | undefined;
  /** Foreground color (default "#000000") */
  fgColor?: string | undefined;
  /** Background color (default "#FFFFFF"); "transparent" is allowed */
  bgColor?: string | undefined;
  /** Content for an accessible <title> element */
  title?: string | undefined;
}

/**
 * A React component that renders a QR code as SVG.
 *
 * - All dark modules are drawn as a **single run-length-compressed `<path>`**
 *   (only three DOM nodes: svg / rect / path)
 * - Encoding and path generation run inside useMemo and recompute only when
 *   value or the encoding options change
 * - The quiet zone comes from shifting the viewBox origin (no transform)
 * - With `responsive`, the SVG fills its container's width and stays square
 *   via the viewBox's intrinsic 1:1 ratio; otherwise it renders at `size`
 * - When the value cannot be encoded (too long, etc.), `encode` throws,
 *   which an Error Boundary can catch
 *
 * When passing a Uint8Array as value, a changed reference triggers
 * re-encoding, so avoid creating a fresh array on every render.
 */
export const QRCode = forwardRef<SVGSVGElement, QRCodeProps>(function QRCode(
  {
    value,
    size = 128,
    responsive = false,
    ecLevel = "M",
    version,
    minVersion,
    mask,
    margin = 4,
    fgColor = "#000000",
    bgColor = "#FFFFFF",
    title,
    style,
    width,
    height,
    ...rest
  },
  ref,
) {
  if (!Number.isFinite(margin) || margin < 0) {
    throw new RangeError(`invalid margin: ${margin}`);
  }

  const { d, moduleCount } = useMemo(() => {
    const matrix = encode(value, { ecLevel, version, minVersion, mask });
    return { d: toSvgPath(matrix), moduleCount: matrix.size };
  }, [value, ecLevel, version, minVersion, mask]);

  const total = moduleCount + margin * 2;

  // Sizing. Explicit width/height props always win. In responsive mode the
  // width fills the container and the height is left to the browser, which
  // derives it from the square viewBox (height:auto keeps the 1:1 ratio and
  // display:block drops the inline-SVG baseline gap).
  const resolvedWidth = width ?? (responsive ? "100%" : size);
  const resolvedHeight = height ?? (responsive ? undefined : size);
  const mergedStyle = responsive
    ? { display: "block", height: "auto", ...style }
    : style;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={resolvedWidth}
      height={resolvedHeight}
      viewBox={`${-margin} ${-margin} ${total} ${total}`}
      role="img"
      shapeRendering="crispEdges"
      style={mergedStyle}
      {...rest}
    >
      {title !== undefined ? <title>{title}</title> : null}
      <rect
        x={-margin}
        y={-margin}
        width={total}
        height={total}
        fill={bgColor}
      />
      <path d={d} fill={fgColor} />
    </svg>
  );
});
