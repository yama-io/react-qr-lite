import { QRCode } from "react-qr-lite";
import { Link } from "react-router";
import { CodeBlock } from "../components/CodeBlock";
import { seoMeta } from "../seo";

export function meta() {
  return seoMeta({
    title: "Getting Started — react-qr-lite",
    description:
      "Install react-qr-lite and render your first QR code: basic usage, customization, responsive sizing, and the React-free core API.",
    path: "/getting-started/",
  });
}

const BASIC_USAGE = `import { QRCode } from "react-qr-lite";

export function App() {
  return <QRCode value="https://example.com" />;
}`;

const CUSTOMIZED = `<QRCode
  value="https://example.com"
  ecLevel="H"
  size={200}
  fgColor="#1a3c8f"
  bgColor="transparent"
  title="Link to example.com"
/>`;

const RESPONSIVE = `<div style={{ width: "100%", maxWidth: 320 }}>
  <QRCode value="https://example.com" responsive />
</div>`;

const CORE_ONLY = `import { encode, toSvgPath } from "react-qr-lite/core";

const matrix = encode("https://example.com", { ecLevel: "M" });
const d = toSvgPath(matrix); // ready to use as <path d={d}>`;

export default function GettingStarted() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <header>
        <h1 className="text-3xl font-bold">Getting Started</h1>
        <p className="text-base-content/70 pt-3">
          Install the package, render a component, done. This page walks through the basics; see
          the <Link to="/api" className="link">API Reference</Link> for every option.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Installation</h2>
        <CodeBlock prompt code="npm install react-qr-lite" />
        <p>
          React ≥ 17 is an <em>optional</em> peer dependency — it is only needed if you use the{" "}
          <code className="badge badge-ghost font-mono">&lt;QRCode /&gt;</code> component. The core
          encoder works without React (see below). Node ≥ 16 is required.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Your first QR code</h2>
        <CodeBlock code={BASIC_USAGE} />
        <div className="flex items-center gap-4">
          <div className="rounded-box bg-white p-3 shadow-sm">
            <QRCode value="https://example.com" size={112} title="QR code for example.com" />
          </div>
          <p className="text-sm">
            The component renders an inline SVG that scales without blurring. Encoding runs inside{" "}
            <code className="font-mono">useMemo</code> and only recomputes when{" "}
            <code className="font-mono">value</code> or an encoding option changes.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Customizing</h2>
        <CodeBlock code={CUSTOMIZED} />
        <div className="flex items-center gap-4">
          <div className="rounded-box bg-base-200 p-3">
            <QRCode
              value="https://example.com"
              ecLevel="H"
              size={112}
              fgColor="#1a3c8f"
              bgColor="transparent"
              title="Customized QR code"
            />
          </div>
          <p className="text-sm">
            Colors, size, error correction level and the quiet zone are all props.{" "}
            <code className="font-mono">bgColor="transparent"</code> lets the page background show
            through. Any other prop is spread onto the <code className="font-mono">&lt;svg&gt;</code>{" "}
            element, and <code className="font-mono">ref</code> is forwarded to it.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Responsive sizing</h2>
        <CodeBlock code={RESPONSIVE} />
        <p>
          With <code className="font-mono">responsive</code>, the SVG fills its container's width
          and stays square via the viewBox's intrinsic 1:1 ratio. Cap it with{" "}
          <code className="font-mono">maxWidth</code> on the container if you want an upper bound.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Without React</h2>
        <p>
          The encoder is exposed as a subpath export,{" "}
          <code className="font-mono">react-qr-lite/core</code>, and pulls in nothing from React:
        </p>
        <CodeBlock code={CORE_ONLY} />
        <p>
          <code className="font-mono">encode</code> returns a{" "}
          <code className="font-mono">QRMatrix</code> — the module grid plus metadata — so you can
          also render to canvas, a terminal, or anything else. See the{" "}
          <Link to="/api" className="link">API Reference</Link> for the shape.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Error handling</h2>
        <div role="alert" className="alert alert-info alert-soft">
          <span>
            If the value cannot be encoded (for example, too long to fit version 40 at the chosen
            error correction level), <code className="font-mono">encode</code> throws an{" "}
            <code className="font-mono">Error</code> during render — catch it with an Error
            Boundary. Invalid props (bad version, mask, or margin) throw a{" "}
            <code className="font-mono">RangeError</code>.
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Accessibility</h2>
        <p>
          The SVG has <code className="font-mono">role="img"</code>, so give it an accessible name:
          pass <code className="font-mono">title</code> (or{" "}
          <code className="font-mono">aria-label</code>) so screen readers can announce what the
          code links to. For purely decorative codes, pass{" "}
          <code className="font-mono">aria-hidden</code> instead.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Next steps</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Browse the <Link to="/examples" className="link">Examples</Link> — Wi-Fi codes, vCards,
            Kanji mode, core-only rendering and more.
          </li>
          <li>
            Tweak every option live in the <Link to="/playground" className="link">Playground</Link>{" "}
            and copy the resulting JSX.
          </li>
          <li>
            Read the full <Link to="/api" className="link">API Reference</Link>.
          </li>
        </ul>
      </section>
    </div>
  );
}
