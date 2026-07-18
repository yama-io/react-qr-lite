// @vitest-environment jsdom
import { act, createRef, StrictMode, type ReactNode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QRCode } from "./QRCode";
import { encode } from "./core/encode";
import { toSvgPath } from "./core/svgpath";

// Wrap encode in a spy so tests can observe how often <QRCode /> re-encodes.
// The wrapper delegates to the real implementation, so rendered output is
// unchanged; the component and this file share the same mocked module.
vi.mock("./core/encode", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./core/encode")>();
  return { ...mod, encode: vi.fn(mod.encode) };
});

const encodeSpy = vi.mocked(encode);

// react-dom refuses act() unless the environment opts in
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("<QRCode /> client-side rendering (jsdom)", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  function mount(ui: ReactNode): HTMLDivElement {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(ui));
    return container;
  }

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    container?.remove();
    container = null;
  });

  it("mounts with createRoot and renders the same path as the core encoder", () => {
    const el = mount(<QRCode value="CLIENT RENDER" />);
    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).toBe("-4 -4 29 29");
    expect(el.querySelector("path")!.getAttribute("d")).toBe(
      toSvgPath(encode("CLIENT RENDER", { ecLevel: "M" })),
    );
  });

  it("updates the rendered path when value changes", () => {
    const el = mount(<QRCode value="BEFORE" />);
    const before = el.querySelector("path")!.getAttribute("d");
    act(() => root!.render(<QRCode value="AFTER" />));
    const after = el.querySelector("path")!.getAttribute("d");
    expect(after).toBe(toSvgPath(encode("AFTER", { ecLevel: "M" })));
    expect(after).not.toBe(before);
  });

  it("re-encodes only when value or an encoding option changes (useMemo)", () => {
    mount(<QRCode value="MEMO" size={128} />);
    const calls = encodeSpy.mock.calls.length;

    // Rendering-only props do not invalidate the memoized encode result
    act(() => root!.render(<QRCode value="MEMO" size={256} fgColor="#333333" />));
    expect(encodeSpy.mock.calls.length).toBe(calls);

    // An encoding option does
    act(() => root!.render(<QRCode value="MEMO" size={256} ecLevel="H" />));
    expect(encodeSpy.mock.calls.length).toBe(calls + 1);
  });

  it("forwards ref to the <svg> element", () => {
    const ref = createRef<SVGSVGElement>();
    mount(<QRCode value="REF" ref={ref} />);
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
    expect(ref.current!.tagName.toLowerCase()).toBe("svg");
  });

  it("renders correctly under StrictMode (render is pure)", () => {
    const el = mount(
      <StrictMode>
        <QRCode value="STRICT MODE" />
      </StrictMode>,
    );
    expect(el.querySelector("path")!.getAttribute("d")).toBe(
      toSvgPath(encode("STRICT MODE", { ecLevel: "M" })),
    );
  });

  it("hydrates server-rendered markup without mismatches", () => {
    const ui = <QRCode value="HYDRATE" title="scan me" />;
    container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToString(ui);
    const serverPath = container.querySelector("path");
    expect(serverPath).not.toBeNull();

    const recoverable: unknown[] = [];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      act(() => {
        root = hydrateRoot(container!, ui, {
          onRecoverableError: (error) => recoverable.push(error),
        });
      });
    } finally {
      errorSpy.mockRestore();
    }
    expect(recoverable).toEqual([]);
    expect(errorSpy).not.toHaveBeenCalled();
    // Hydration adopted the server-rendered DOM instead of replacing it
    expect(container.querySelector("path")).toBe(serverPath);
    expect(container.querySelector("title")!.textContent).toBe("scan me");
  });
});
