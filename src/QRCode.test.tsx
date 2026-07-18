import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QRCode } from "./QRCode";
import { encode } from "./core/encode";
import { toSvgPath } from "./core/svgpath";

describe("<QRCode />", () => {
  it("a single <path> carries the same d attribute as the core", () => {
    const html = renderToStaticMarkup(<QRCode value="COMPONENT TEST" />);
    const expected = toSvgPath(encode("COMPONENT TEST", { ecLevel: "M" }));
    expect(html.match(/<path /g)).toHaveLength(1);
    expect(html).toContain(`d="${expected}"`);
  });

  it("defaults: 128px, quiet zone 4, white background, black foreground, role=img", () => {
    const html = renderToStaticMarkup(<QRCode value="DEFAULTS" />);
    // v1 (21) + 4×2 = 29
    expect(html).toContain('viewBox="-4 -4 29 29"');
    expect(html).toContain('width="128"');
    expect(html).toContain('height="128"');
    expect(html).toContain('fill="#FFFFFF"');
    expect(html).toContain('fill="#000000"');
    expect(html).toContain('role="img"');
    expect(html).toContain('shape-rendering="crispEdges"');
  });

  it("encoding options (ecLevel / version / mask) are applied", () => {
    const html = renderToStaticMarkup(
      <QRCode value="OPTS" ecLevel="H" version={5} mask={3} />,
    );
    const expected = toSvgPath(encode("OPTS", { ecLevel: "H", version: 5, mask: 3 }));
    expect(html).toContain(`d="${expected}"`);
    // v5 = 37 modules + 8
    expect(html).toContain('viewBox="-4 -4 45 45"');
  });

  it("margin=0 makes the viewBox exactly the matrix size", () => {
    const html = renderToStaticMarkup(<QRCode value="M0" margin={0} />);
    expect(html).toContain('viewBox="0 0 21 21"');
    expect(html).toContain('x="0" y="0" width="21" height="21"');
  });

  it("customizing colors, size, and title", () => {
    const html = renderToStaticMarkup(
      <QRCode
        value="CUSTOM"
        size={256}
        fgColor="#112233"
        bgColor="transparent"
        title="サイトへのリンク"
      />,
    );
    expect(html).toContain('width="256"');
    expect(html).toContain('fill="transparent"');
    expect(html).toContain('fill="#112233"');
    expect(html).toContain("<title>サイトへのリンク</title>");
  });

  it("remaining props are spread onto the <svg> and can override defaults", () => {
    const html = renderToStaticMarkup(
      <QRCode value="SPREAD" className="qr" aria-label="QR" role="presentation" />,
    );
    expect(html).toContain('class="qr"');
    expect(html).toContain('aria-label="QR"');
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain('role="img"');
  });

  it("allowKanji={false} encodes in byte mode (kanji mode by default)", () => {
    const html = renderToStaticMarkup(<QRCode value="漢字" allowKanji={false} />);
    const byte = toSvgPath(encode("漢字", { ecLevel: "M", allowKanji: false }));
    expect(html).toContain(`d="${byte}"`);
    expect(byte).not.toBe(toSvgPath(encode("漢字", { ecLevel: "M" })));
  });

  it("Uint8Array input also encodes", () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    const html = renderToStaticMarkup(<QRCode value={bytes} />);
    expect(html).toContain(`d="${toSvgPath(encode(bytes, { ecLevel: "M" }))}"`);
  });

  it("unencodable input throws (catchable by an Error Boundary)", () => {
    expect(() =>
      renderToStaticMarkup(<QRCode value={"x".repeat(50)} version={1} />),
    ).toThrow(/exceeds/);
  });

  it("negative or non-finite margin is RangeError", () => {
    expect(() =>
      renderToStaticMarkup(<QRCode value="M" margin={-1} />),
    ).toThrow(RangeError);
    expect(() =>
      renderToStaticMarkup(<QRCode value="M" margin={NaN} />),
    ).toThrow(RangeError);
  });

  // Grabs just the opening <svg ...> tag so assertions don't match the <rect>
  const svgTag = (html: string) => html.slice(0, html.indexOf(">") + 1);

  describe("responsive sizing", () => {
    it("size accepts a CSS length string and passes it through to width/height", () => {
      const tag = svgTag(renderToStaticMarkup(<QRCode value="REM" size="20rem" />));
      expect(tag).toContain('width="20rem"');
      expect(tag).toContain('height="20rem"');
    });

    it("responsive fills width and drops the fixed height for a square aspect ratio", () => {
      const html = renderToStaticMarkup(<QRCode value="RESPONSIVE" responsive />);
      const tag = svgTag(html);
      expect(tag).toContain('width="100%"');
      // no fixed height attribute on the <svg> (the <rect> still has one)
      expect(tag).not.toContain("height=");
      // height:auto + display:block keep it square and gap-free
      expect(tag).toContain("height:auto");
      expect(tag).toContain("display:block");
      // viewBox is still square, so the intrinsic ratio is 1:1
      expect(tag).toContain('viewBox="-4 -4 29 29"');
    });

    it("responsive overrides size (no fixed px dimensions)", () => {
      const tag = svgTag(
        renderToStaticMarkup(<QRCode value="OVERRIDE" size={512} responsive />),
      );
      expect(tag).not.toContain('width="512"');
      expect(tag).toContain('width="100%"');
    });

    it("explicit width/height props win even in responsive mode", () => {
      const tag = svgTag(
        renderToStaticMarkup(
          <QRCode value="EXPLICIT" responsive width={200} height={200} />,
        ),
      );
      expect(tag).toContain('width="200"');
      expect(tag).toContain('height="200"');
    });

    it("user style is merged with (and can override) the responsive style", () => {
      const tag = svgTag(
        renderToStaticMarkup(
          <QRCode value="CAP" responsive style={{ maxWidth: 256 }} />,
        ),
      );
      expect(tag).toContain("max-width:256px");
      expect(tag).toContain("display:block");
    });

    it("non-responsive default is unchanged (128px, no injected style)", () => {
      const tag = svgTag(renderToStaticMarkup(<QRCode value="FIXED" />));
      expect(tag).toContain('width="128"');
      expect(tag).toContain('height="128"');
      expect(tag).not.toContain("style=");
    });
  });
});
