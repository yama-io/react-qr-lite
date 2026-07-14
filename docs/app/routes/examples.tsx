import { useMemo, type ReactNode } from "react";
import { QRCode, encode, toSvgPath, type ECLevel } from "react-qr-lite";
import { Link } from "react-router";
import { CodeBlock } from "../components/CodeBlock";
import { seoMeta } from "../seo";

export function meta() {
  return seoMeta({
    title: "Examples — react-qr-lite",
    description:
      "Live react-qr-lite examples: error correction levels, custom colors, responsive sizing, Wi-Fi and contact QR codes, Kanji mode, raw bytes, and the core API.",
    path: "/examples/",
  });
}

const BASIC = `<QRCode value="https://example.com" size={144} />`;

const EC_LEVELS = `{(["L", "M", "Q", "H"] as const).map((level) => (
  <QRCode key={level} value="https://example.com" ecLevel={level} size={96} />
))}`;

const COLORS = `<QRCode
  value="https://example.com"
  fgColor="#1a3c8f"
  bgColor="transparent"
  ecLevel="Q"
  size={144}
/>`;

const RESPONSIVE = `<div style={{ width: "100%", maxWidth: 240 }}>
  <QRCode value="https://example.com" responsive />
</div>`;

const WIFI_VALUE = "WIFI:T:WPA;S:MyNetwork;P:secret123;;";
const WIFI = `// Scanning joins the Wi-Fi network directly
<QRCode
  value="WIFI:T:WPA;S:MyNetwork;P:secret123;;"
  ecLevel="Q"
  size={144}
/>`;

const MECARD_VALUE = "MECARD:N:Doe,John;TEL:+15551234567;EMAIL:john@example.com;;";
const MECARD = `// MECARD — scanning adds a contact
<QRCode
  value="MECARD:N:Doe,John;TEL:+15551234567;EMAIL:john@example.com;;"
  size={144}
/>`;

const KANJI_VALUE = "こんにちは、世界";
const KANJI = `// Shift-JIS-encodable text is packed at 13 bits per
// character (Kanji mode) instead of UTF-8 bytes
<QRCode value="こんにちは、世界" size={144} />`;

const BYTES = `// A Uint8Array always uses Byte mode.
// Keep the reference stable across renders (e.g. useMemo).
const payload = useMemo(
  () => new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
  [],
);

<QRCode value={payload} size={144} />`;

const CORE = `import { encode, toSvgPath } from "react-qr-lite/core";

const matrix = encode("HELLO WORLD", { ecLevel: "Q" });
const d = toSvgPath(matrix);
const total = matrix.size + 8; // 4-module quiet zone per side

<svg viewBox={\`-4 -4 \${total} \${total}\`} width={144} height={144}>
  <rect x={-4} y={-4} width={total} height={total} fill="#fff" />
  <path d={d} fill="#000" />
</svg>`;

/** Renders a QR code built with the core API only (no <QRCode /> component). */
function CoreSvgDemo() {
  const { d, total } = useMemo(() => {
    const matrix = encode("HELLO WORLD", { ecLevel: "Q" });
    return { d: toSvgPath(matrix), total: matrix.size + 8 };
  }, []);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={144}
      height={144}
      viewBox={`-4 -4 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code generated with the core API"
    >
      <rect x={-4} y={-4} width={total} height={total} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

function ByteModeDemo() {
  const payload = useMemo(() => new Uint8Array([0xde, 0xad, 0xbe, 0xef]), []);
  return <QRCode value={payload} size={144} title="Byte mode QR code" />;
}

interface ExampleCardProps {
  title: string;
  description: ReactNode;
  code: string;
  children: ReactNode;
}

function ExampleCard({ title, description, code, children }: ExampleCardProps) {
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title">{title}</h2>
        <p className="text-sm">{description}</p>
        <CodeBlock code={code} />
        <div className="flex grow items-end justify-center pt-2">{children}</div>
      </div>
    </div>
  );
}

export default function Examples() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold">Examples</h1>
        <p className="text-base-content/70 pt-3">
          Every example on this page is rendered live by the library itself. Want to experiment?
          Open the <Link to="/playground" className="link">Playground</Link>.
        </p>
      </header>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <ExampleCard
          title="Basic"
          description="The only required prop is value. Everything else has sensible defaults: 128 px, error correction level M, a 4-module quiet zone."
          code={BASIC}
        >
          <div className="rounded-box bg-white p-3 shadow-sm">
            <QRCode value="https://example.com" size={144} title="Basic QR code" />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Error correction levels"
          description="Higher levels survive more damage (L ≈ 7%, M ≈ 15%, Q ≈ 25%, H ≈ 30% of codewords restorable) at the cost of a denser symbol. Watch the module count grow."
          code={EC_LEVELS}
        >
          <div className="flex flex-wrap justify-center gap-3">
            {(["L", "M", "Q", "H"] as const satisfies readonly ECLevel[]).map((level) => (
              <div key={level} className="flex flex-col items-center gap-1">
                <div className="rounded-box bg-white p-2 shadow-sm">
                  <QRCode
                    value="https://example.com"
                    ecLevel={level}
                    size={96}
                    title={`QR code at level ${level}`}
                  />
                </div>
                <span className="badge badge-ghost badge-sm">{level}</span>
              </div>
            ))}
          </div>
        </ExampleCard>

        <ExampleCard
          title="Custom colors"
          description={
            <>
              Any CSS color works for <code className="font-mono">fgColor</code> and{" "}
              <code className="font-mono">bgColor</code>; <code className="font-mono">
              "transparent"</code> lets the page show through. Keep the contrast high — scanners
              need it.
            </>
          }
          code={COLORS}
        >
          <div className="rounded-box bg-linear-to-br from-sky-100 to-indigo-200 p-3">
            <QRCode
              value="https://example.com"
              fgColor="#1a3c8f"
              bgColor="transparent"
              ecLevel="Q"
              size={144}
              title="QR code with custom colors"
            />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Responsive"
          description={
            <>
              With <code className="font-mono">responsive</code>, the SVG fills its container's
              width and stays square via the viewBox's intrinsic 1:1 ratio — resize the window to
              see it scale.
            </>
          }
          code={RESPONSIVE}
        >
          <div className="rounded-box w-full max-w-60 bg-white p-3 shadow-sm">
            <QRCode value="https://example.com" responsive title="Responsive QR code" />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Wi-Fi network"
          description={
            <>
              The <code className="font-mono">WIFI:</code> scheme is understood by iOS and Android
              camera apps: scanning joins the network without typing the password.
            </>
          }
          code={WIFI}
        >
          <div className="rounded-box bg-white p-3 shadow-sm">
            <QRCode value={WIFI_VALUE} ecLevel="Q" size={144} title="Wi-Fi network QR code" />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Contact card (MECARD)"
          description="Encode contact details so a scan offers to add them to the address book. The compact MECARD format keeps the symbol small; full vCard text works the same way."
          code={MECARD}
        >
          <div className="rounded-box bg-white p-3 shadow-sm">
            <QRCode value={MECARD_VALUE} size={144} title="Contact card QR code" />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Kanji mode"
          description="Strings consisting entirely of double-byte Shift-JIS characters are detected automatically and packed at 13 bits per character — denser than UTF-8 bytes. On runtimes without shift_jis support it falls back to Byte mode; the code stays scannable either way."
          code={KANJI}
        >
          <div className="rounded-box bg-white p-3 shadow-sm">
            <QRCode value={KANJI_VALUE} size={144} title="Kanji mode QR code" />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Raw bytes"
          description="Pass a Uint8Array to encode arbitrary binary data in Byte mode — no string round-trip."
          code={BYTES}
        >
          <div className="rounded-box bg-white p-3 shadow-sm">
            <ByteModeDemo />
          </div>
        </ExampleCard>
      </div>

      <div className="card card-border bg-base-100">
        <div className="card-body gap-4">
          <h2 className="card-title">Without React — the core API</h2>
          <p className="text-sm">
            The same encoder, no component: <code className="font-mono">encode</code> returns the
            module matrix and <code className="font-mono">toSvgPath</code> turns it into a single{" "}
            <code className="font-mono">&lt;path&gt;</code>. This demo builds the SVG by hand —
            useful for canvas, terminals, server-side rendering, or other frameworks.
          </p>
          <div className="grid items-start gap-4 lg:grid-cols-[1fr_auto]">
            <CodeBlock code={CORE} />
            <div className="rounded-box justify-self-center bg-white p-3 shadow-sm">
              <CoreSvgDemo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
