import { QRCode } from "react-qr-lite";
import { Link } from "react-router";
import { CodeBlock } from "../components/CodeBlock";
import { GITHUB_URL } from "../components/SiteLayout";
import { seoMeta } from "../seo";

export function meta() {
  return seoMeta({
    title: "react-qr-lite — Tiny QR code generator for React",
    description:
      "Fast, tiny QR code generator for React (SVG output). Zero dependencies, 4.48 KB core, from-scratch ISO/IEC 18004 encoder.",
    path: "/",
  });
}

const FEATURES = [
  {
    title: "Tiny",
    body: "4.48 KB core (minified + brotli), enforced by size-limit. Lookup tables are computed at runtime instead of being shipped in the bundle.",
  },
  {
    title: "Fast",
    body: "A typical URL encodes in about 0.2 ms with automatic mask selection, and about 24 µs with a fixed mask.",
  },
  {
    title: "Minimal DOM",
    body: "All dark modules are drawn as a single run-length-compressed <path>. The whole component is 3 DOM nodes: svg, rect, path.",
  },
  {
    title: "Full encoder",
    body: "A from-scratch ISO/IEC 18004 implementation: Numeric, Alphanumeric, Byte (UTF-8) and Kanji modes, versions 1–40, all four error correction levels, automatic mask selection — verified end-to-end by decoding with jsQR.",
  },
  {
    title: "Framework-agnostic core",
    body: "Import react-qr-lite/core to get just the encoder, with no dependency on React. Render to canvas, a terminal, or anything else.",
  },
  {
    title: "TypeScript native",
    body: "Strict types out of the box, ESM + CJS dual build, zero runtime dependencies.",
  },
];

const QUICK_EXAMPLE = `import { QRCode } from "react-qr-lite";

export function App() {
  return <QRCode value="https://example.com" size={160} />;
}`;

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="hero bg-base-200 rounded-box py-12">
        <div className="hero-content flex-col gap-10 text-center lg:flex-row-reverse lg:text-left">
          <div className="rounded-box bg-white p-4 shadow-md">
            <QRCode
              value="https://github.com/yama-io/react-qr-lite"
              size={176}
              title="react-qr-lite on GitHub"
            />
          </div>
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold sm:text-5xl">react-qr-lite</h1>
            <p className="py-6 text-lg">
              Fast, tiny QR code generator for React, rendered as SVG. Zero dependencies — the
              encoder is a from-scratch implementation of ISO/IEC 18004, not a wrapper around an
              existing library.
            </p>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              <Link to="/getting-started" className="btn btn-primary">
                Get Started
              </Link>
              <Link to="/playground" className="btn">
                Try the Playground
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn btn-ghost">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="stats stats-vertical sm:stats-horizontal w-full shadow-sm">
          <div className="stat">
            <div className="stat-title">Core bundle</div>
            <div className="stat-value">4.48 KB</div>
            <div className="stat-desc">minified + brotli</div>
          </div>
          <div className="stat">
            <div className="stat-title">With the component</div>
            <div className="stat-value">4.96 KB</div>
            <div className="stat-desc">react excluded (peer dep)</div>
          </div>
          <div className="stat">
            <div className="stat-title">DOM nodes</div>
            <div className="stat-value">3</div>
            <div className="stat-desc">svg / rect / path</div>
          </div>
          <div className="stat">
            <div className="stat-title">Dependencies</div>
            <div className="stat-value">0</div>
            <div className="stat-desc">React is an optional peer</div>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Install &amp; render</h2>
          <CodeBlock prompt code="npm install react-qr-lite" />
          <CodeBlock code={QUICK_EXAMPLE} />
        </div>
        <div className="flex flex-col items-center gap-4">
          <h2 className="self-start text-2xl font-bold lg:invisible">Result</h2>
          <div className="rounded-box bg-white p-4 shadow-sm">
            <QRCode value="https://example.com" size={160} title="QR code for example.com" />
          </div>
          <p className="text-base-content/70 text-sm">
            That's it — no config, no providers, no CSS to import.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold">Why react-qr-lite?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card card-border bg-base-100">
              <div className="card-body">
                <h3 className="card-title text-base">{f.title}</h3>
                <p className="text-sm">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
