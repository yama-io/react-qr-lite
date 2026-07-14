import { useMemo, useRef, useState } from "react";
import { QRCode, encode, type ECLevel } from "react-qr-lite";
import { detectMode } from "react-qr-lite/core";
import { CodeBlock } from "../components/CodeBlock";
import { seoMeta } from "../seo";

export function meta() {
  return seoMeta({
    title: "Playground — react-qr-lite",
    description:
      "Interactive react-qr-lite playground: tweak content, error correction, size, colors, version and mask live, then copy the JSX or download the SVG.",
    path: "/playground/",
  });
}

const VERSIONS = Array.from({ length: 40 }, (_, i) => i + 1);
const MASKS = Array.from({ length: 8 }, (_, i) => i);

export default function Playground() {
  const [value, setValue] = useState("https://github.com/yama-io/react-qr-lite");
  const [ecLevel, setEcLevel] = useState<ECLevel>("M");
  const [size, setSize] = useState(224);
  const [margin, setMargin] = useState(4);
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparentBg, setTransparentBg] = useState(false);
  const [version, setVersion] = useState(0); // 0 = auto
  const [mask, setMask] = useState(-1); // -1 = auto
  const svgRef = useRef<SVGSVGElement>(null);

  // Validate the current inputs (and grab symbol metadata) without letting
  // an encoding failure crash the render of <QRCode /> below.
  const encoded = useMemo(() => {
    try {
      const matrix = encode(value, {
        ecLevel,
        version: version === 0 ? undefined : version,
        mask: mask === -1 ? undefined : mask,
      });
      return { matrix, error: null as string | null };
    } catch (err) {
      return { matrix: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [value, ecLevel, version, mask]);

  const mode = useMemo(() => (value.length > 0 ? detectMode(value) : null), [value]);

  const snippet = useMemo(() => {
    const props = [`value=${JSON.stringify(value)}`];
    if (size !== 128) props.push(`size={${size}}`);
    if (ecLevel !== "M") props.push(`ecLevel="${ecLevel}"`);
    if (margin !== 4) props.push(`margin={${margin}}`);
    if (fgColor.toLowerCase() !== "#000000") props.push(`fgColor="${fgColor}"`);
    if (transparentBg) props.push(`bgColor="transparent"`);
    else if (bgColor.toLowerCase() !== "#ffffff") props.push(`bgColor="${bgColor}"`);
    if (version !== 0) props.push(`version={${version}}`);
    if (mask !== -1) props.push(`mask={${mask}}`);
    return `import { QRCode } from "react-qr-lite";\n\n<QRCode\n  ${props.join("\n  ")}\n/>`;
  }, [value, size, ecLevel, margin, fgColor, bgColor, transparentBg, version, mask]);

  const downloadSvg = () => {
    const node = svgRef.current;
    if (!node) return;
    const blob = new Blob([new XMLSerializer().serializeToString(node)], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qrcode.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold">Playground</h1>
        <p className="text-base-content/70 pt-3">
          Tweak every option live, then copy the JSX or download the SVG. Encoding runs in your
          browser with the actual library.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="flex flex-col gap-4">
          <fieldset className="fieldset bg-base-200 rounded-box p-4">
            <legend className="fieldset-legend">Content</legend>
            <textarea
              className="textarea w-full font-mono"
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Text or URL to encode"
              aria-label="Content to encode"
            />
            <p className="label">
              Strings get automatic mode detection
              {mode !== null && (
                <>
                  {" — detected: "}
                  <span className="badge badge-ghost badge-sm font-mono">{mode}</span>
                </>
              )}
            </p>
          </fieldset>

          <fieldset className="fieldset bg-base-200 rounded-box p-4">
            <legend className="fieldset-legend">Error correction</legend>
            <select
              className="select w-full"
              value={ecLevel}
              onChange={(e) => setEcLevel(e.target.value as ECLevel)}
              aria-label="Error correction level"
            >
              <option value="L">L — recovers ~7% (densest data)</option>
              <option value="M">M — recovers ~15% (default)</option>
              <option value="Q">Q — recovers ~25%</option>
              <option value="H">H — recovers ~30% (most robust)</option>
            </select>
          </fieldset>

          <fieldset className="fieldset bg-base-200 rounded-box p-4">
            <legend className="fieldset-legend">Size &amp; quiet zone</legend>
            <label className="label" htmlFor="pg-size">
              Size: {size} px
            </label>
            <input
              id="pg-size"
              type="range"
              min={96}
              max={512}
              step={16}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="range w-full"
            />
            <label className="label" htmlFor="pg-margin">
              Margin: {margin} modules{margin === 4 ? " (spec recommendation)" : ""}
            </label>
            <input
              id="pg-margin"
              type="range"
              min={0}
              max={8}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="range w-full"
            />
          </fieldset>

          <fieldset className="fieldset bg-base-200 rounded-box p-4">
            <legend className="fieldset-legend">Colors</legend>
            <div className="flex flex-wrap items-end gap-6">
              <label className="flex flex-col gap-1">
                <span className="label">Foreground</span>
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border-0 bg-transparent p-0"
                  aria-label="Foreground color"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Background</span>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  disabled={transparentBg}
                  className="h-10 w-16 cursor-pointer rounded border-0 bg-transparent p-0 disabled:opacity-30"
                  aria-label="Background color"
                />
              </label>
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="toggle"
                  checked={transparentBg}
                  onChange={(e) => setTransparentBg(e.target.checked)}
                />
                Transparent background
              </label>
            </div>
          </fieldset>

          <fieldset className="fieldset bg-base-200 rounded-box p-4">
            <legend className="fieldset-legend">Advanced</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pg-version">
                  Version
                </label>
                <select
                  id="pg-version"
                  className="select w-full"
                  value={version}
                  onChange={(e) => setVersion(Number(e.target.value))}
                >
                  <option value={0}>Auto — smallest that fits</option>
                  {VERSIONS.map((v) => (
                    <option key={v} value={v}>
                      {v} ({17 + v * 4}×{17 + v * 4} modules)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pg-mask">
                  Mask pattern
                </label>
                <select
                  id="pg-mask"
                  className="select w-full"
                  value={mask}
                  onChange={(e) => setMask(Number(e.target.value))}
                >
                  <option value={-1}>Auto — lowest penalty</option>
                  {MASKS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="card card-border bg-base-100">
            <div className="card-body items-center gap-4">
              <h2 className="card-title self-start">Preview</h2>
              {encoded.error !== null ? (
                <div role="alert" className="alert alert-error">
                  <span>{encoded.error}</span>
                </div>
              ) : (
                <>
                  <div className="rounded-box max-w-full bg-white p-4 shadow-sm">
                    <QRCode
                      ref={svgRef}
                      value={value}
                      size={size}
                      ecLevel={ecLevel}
                      margin={margin}
                      fgColor={fgColor}
                      bgColor={transparentBg ? "transparent" : bgColor}
                      version={version === 0 ? undefined : version}
                      mask={mask === -1 ? undefined : mask}
                      title="Playground QR code"
                      style={{ maxWidth: "100%", height: "auto" }}
                    />
                  </div>
                  {encoded.matrix !== null && (
                    <div className="flex flex-wrap justify-center gap-2">
                      <span className="badge badge-ghost">Version {encoded.matrix.version}</span>
                      <span className="badge badge-ghost">
                        {encoded.matrix.size}×{encoded.matrix.size} modules
                      </span>
                      <span className="badge badge-ghost">Mask {encoded.matrix.mask}</span>
                    </div>
                  )}
                  <div className="card-actions">
                    <button type="button" className="btn btn-sm" onClick={downloadSvg}>
                      Download SVG
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Code</h2>
            <CodeBlock code={snippet} />
          </div>
        </div>
      </div>
    </div>
  );
}
