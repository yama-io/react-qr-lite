import { Link } from "react-router";
import { CodeBlock } from "../components/CodeBlock";
import { seoMeta } from "../seo";

export function meta() {
  return seoMeta({
    title: "API Reference — react-qr-lite",
    description:
      "Full API reference for react-qr-lite: <QRCode /> props, encode options, QRMatrix, toSvgPath, and the core helpers.",
    path: "/api/",
  });
}

const ENCODE_SIGNATURE = `import { encode } from "react-qr-lite/core";

function encode(
  data: string | Uint8Array,
  options?: EncodeOptions,
): QRMatrix;`;

const TOSVGPATH_SIGNATURE = `import { toSvgPath } from "react-qr-lite/core";

function toSvgPath(matrix: QRMatrix): string;`;

interface Row {
  name: string;
  type: string;
  def: string;
  desc: string;
}

const QRCODE_PROPS: Row[] = [
  {
    name: "value",
    type: "string | Uint8Array",
    def: "—",
    desc: "Content to encode. Strings get automatic mode detection (Numeric / Alphanumeric / Kanji / Byte); a Uint8Array always uses Byte mode.",
  },
  {
    name: "size",
    type: "number | string",
    def: "128",
    desc: 'Rendered size. A number is pixels; a string is passed through as a CSS length ("20rem", "50vw"). Ignored when responsive is set.',
  },
  {
    name: "responsive",
    type: "boolean",
    def: "false",
    desc: "Fill the container's width, keeping a 1:1 aspect ratio. Overrides size.",
  },
  {
    name: "ecLevel",
    type: '"L" | "M" | "Q" | "H"',
    def: '"M"',
    desc: "Error correction level: roughly 7% / 15% / 25% / 30% of codewords can be restored.",
  },
  {
    name: "margin",
    type: "number",
    def: "4",
    desc: "Quiet zone width in modules (the spec recommends 4). Must be a non-negative finite number.",
  },
  {
    name: "fgColor",
    type: "string",
    def: '"#000000"',
    desc: "Foreground (module) color.",
  },
  {
    name: "bgColor",
    type: "string",
    def: '"#FFFFFF"',
    desc: 'Background color. "transparent" is allowed.',
  },
  {
    name: "title",
    type: "string",
    def: "—",
    desc: "Accessible <title> for the SVG.",
  },
  {
    name: "version",
    type: "number",
    def: "auto",
    desc: "Pin the symbol version (1–40). Defaults to the smallest version that fits.",
  },
  {
    name: "minVersion",
    type: "number",
    def: "1",
    desc: "Lower bound for automatic version selection.",
  },
  {
    name: "mask",
    type: "number",
    def: "auto",
    desc: "Mask pattern 0–7. Auto-selects the lowest-penalty mask by default.",
  },
];

const ENCODE_OPTIONS: Row[] = [
  {
    name: "ecLevel",
    type: '"L" | "M" | "Q" | "H"',
    def: '"M"',
    desc: "Error correction level.",
  },
  {
    name: "version",
    type: "number",
    def: "auto",
    desc: "Pin the version (defaults to the smallest version that fits).",
  },
  {
    name: "minVersion",
    type: "number",
    def: "1",
    desc: "Minimum version for auto-selection.",
  },
  {
    name: "mask",
    type: "number",
    def: "auto",
    desc: "Mask number 0–7 (auto-selects the lowest 4-rule penalty of the 8 masks by default).",
  },
];

const QRMATRIX_FIELDS: Row[] = [
  {
    name: "size",
    type: "number",
    def: "—",
    desc: "Modules per side (21 for version 1, up to 177 for version 40).",
  },
  {
    name: "modules",
    type: "Uint8Array",
    def: "—",
    desc: "Row-major flat array of size × size entries; 1 = dark module. Coordinates are (x, y) = (column, row).",
  },
  {
    name: "version",
    type: "number",
    def: "—",
    desc: "The symbol version actually used (1–40).",
  },
  {
    name: "ecLevel",
    type: '"L" | "M" | "Q" | "H"',
    def: "—",
    desc: "The error correction level used.",
  },
  {
    name: "mask",
    type: "number",
    def: "—",
    desc: "The mask pattern applied (0–7).",
  },
];

const CORE_HELPERS: { name: string; desc: string }[] = [
  { name: "getModule(matrix, x, y)", desc: "Reads one module from a QRMatrix as 0 | 1. Coordinates are (x, y) = (column, row)." },
  { name: "detectMode(text)", desc: 'Returns the mode auto-detection would pick for a string: "numeric" | "alphanumeric" | "kanji" | "byte".' },
  { name: "chooseVersion(data, options?)", desc: "The smallest version (1–40) that can hold the data — what encode() auto-selects. Options: ecLevel (default \"M\") and minVersion. Throws when the data does not fit any version." },
];

function PropsTable({ rows, nameHeader = "Prop" }: { rows: Row[]; nameHeader?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra table-sm">
        <thead>
          <tr>
            <th>{nameHeader}</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="whitespace-nowrap">
                <code className="font-mono font-semibold">{row.name}</code>
              </td>
              <td className="whitespace-nowrap">
                <code className="font-mono">{row.type}</code>
              </td>
              <td className="whitespace-nowrap">
                <code className="font-mono">{row.def}</code>
              </td>
              <td className="min-w-64">{row.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiReference() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-12">
      <header>
        <h1 className="text-3xl font-bold">API Reference</h1>
        <p className="text-base-content/70 pt-3">
          Two entry points: the root package with the React component, and a React-free core.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Entry points</h2>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Import</th>
                <th>Contents</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap">
                  <code className="font-mono font-semibold">react-qr-lite</code>
                </td>
                <td>
                  <code className="font-mono">QRCode</code> component plus the full core API
                  re-exported (<code className="font-mono">encode</code>,{" "}
                  <code className="font-mono">toSvgPath</code>,{" "}
                  <code className="font-mono">getModule</code>,{" "}
                  <code className="font-mono">chooseVersion</code>,{" "}
                  <code className="font-mono">detectMode</code> and their types).
                </td>
              </tr>
              <tr>
                <td className="whitespace-nowrap">
                  <code className="font-mono font-semibold">react-qr-lite/core</code>
                </td>
                <td>
                  The complete framework-agnostic encoder — no dependency on React or{" "}
                  <code className="font-mono">react/jsx-runtime</code>.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          Both are dual ESM/CJS builds with TypeScript declarations. The package validates inputs
          and throws <code className="font-mono">RangeError</code> for invalid parameters and{" "}
          <code className="font-mono">Error</code> when data does not fit.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">
          <code className="font-mono">&lt;QRCode /&gt;</code>
        </h2>
        <PropsTable rows={QRCODE_PROPS} />
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            All other props are spread onto the <code className="font-mono">&lt;svg&gt;</code>{" "}
            element, and <code className="font-mono">ref</code> is forwarded to it.
          </li>
          <li>
            Encoding runs inside <code className="font-mono">useMemo</code> and recomputes only
            when <code className="font-mono">value</code> or the encoding options change. When
            passing a <code className="font-mono">Uint8Array</code>, keep the reference stable
            across renders to avoid re-encoding.
          </li>
          <li>
            If the value cannot be encoded (e.g. too long for version 40),{" "}
            <code className="font-mono">encode</code> throws — catch it with an Error Boundary.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">
          <code className="font-mono">encode(data, options?)</code>
        </h2>
        <CodeBlock code={ENCODE_SIGNATURE} />
        <p>
          Generates a QR matrix from a string or byte array — the core's top-level API. Strings get
          automatic mode detection: digits → Numeric, the alphanumeric charset → Alphanumeric, all
          double-byte Shift-JIS → Kanji, anything else → Byte (UTF-8). A{" "}
          <code className="font-mono">Uint8Array</code> always uses Byte mode.
        </p>
        <h3 className="text-lg font-semibold">Options</h3>
        <PropsTable rows={ENCODE_OPTIONS} nameHeader="Option" />
        <h3 className="text-lg font-semibold">Throws</h3>
        <ul className="list-inside list-disc space-y-1 text-sm">
          <li>
            <code className="font-mono">RangeError</code> — data is neither a string nor a{" "}
            <code className="font-mono">Uint8Array</code>, or an option is invalid.
          </li>
          <li>
            <code className="font-mono">Error</code> — the data does not fit the requested
            version/level.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">
          <code className="font-mono">QRMatrix</code>
        </h2>
        <p>The return type of <code className="font-mono">encode</code>:</p>
        <PropsTable rows={QRMATRIX_FIELDS} nameHeader="Field" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">
          <code className="font-mono">toSvgPath(matrix)</code>
        </h2>
        <CodeBlock code={TOSVGPATH_SIGNATURE} />
        <p>
          Converts a matrix into a <code className="font-mono">d</code>-attribute string for a
          single SVG <code className="font-mono">&lt;path&gt;</code>. Horizontal runs of dark
          modules are merged run-length style, shrinking the path data to roughly 30–40% of the
          naive one-rect-per-module output. Coordinates: 1 module = 1 unit; the quiet zone is not
          included — provide it by shifting the viewBox (as the component does) or with a
          transform.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Helpers</h2>
        <p className="text-sm">
          Three small helpers round out the API. Most applications only need{" "}
          <code className="font-mono">encode</code> and{" "}
          <code className="font-mono">toSvgPath</code>. The internal pipeline stages (segment
          construction, Reed-Solomon, matrix placement) are deliberately not exported — they are
          implementation details, free to change between releases.
        </p>
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>Export</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {CORE_HELPERS.map((row) => (
                <tr key={row.name}>
                  <td>
                    <code className="font-mono">{row.name}</code>
                  </td>
                  <td className="min-w-64">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div role="alert" className="alert alert-soft">
          <span>
            Want to see these options in action? Head over to the{" "}
            <Link to="/playground" className="link">Playground</Link> and tweak them live.
          </span>
        </div>
      </section>
    </div>
  );
}
