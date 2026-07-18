import * as React from "react";
import { renderToReadableStream } from "react-server-dom-turbopack/server.edge";
import { describe, expect, it } from "vitest";
import { QRCode } from "./QRCode";
import { encode } from "./core/encode";
import { toSvgPath } from "./core/svgpath";

/**
 * RSC (React Server Components) smoke test.
 *
 * Runs in the dedicated "rsc" vitest project (see vitest.workspace.ts),
 * whose test process enables Node's `react-server` export condition — the
 * module resolution RSC runtimes (Next.js App Router, etc.) use. Under it,
 * `react` resolves to its server subset (no useState/useEffect), and the
 * tree is rendered by the Flight renderer instead of react-dom. This proves
 * <QRCode /> can be used directly in a Server Component without "use client".
 */

/** Renders a tree to its complete Flight (RSC) payload, collecting render errors. */
async function renderToFlightPayload(
  model: React.ReactNode,
): Promise<{ payload: string; errors: unknown[] }> {
  const errors: unknown[] = [];
  const stream = renderToReadableStream(model, null, {
    onError(error) {
      errors.push(error);
    },
  });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let payload = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    payload += decoder.decode(value, { stream: true });
  }
  payload += decoder.decode();
  return { payload, errors };
}

describe("<QRCode /> as a React Server Component", () => {
  it("resolved under the react-server condition (the subset without client-only hooks)", () => {
    // Guard: if the condition were not active this suite would silently
    // test the client build again
    expect((React as { useState?: unknown }).useState).toBeUndefined();
    // The only two React APIs QRCode uses both exist in the server subset
    expect(React.useMemo).toBeTypeOf("function");
    expect(React.forwardRef).toBeTypeOf("function");
  });

  it("renders via Flight as a Server Component, with the same d attribute as the core in the payload", async () => {
    const { payload, errors } = await renderToFlightPayload(
      <QRCode value="RSC SMOKE" title="server rendered" />,
    );
    expect(errors).toEqual([]);
    // Host elements are serialized as ["$","svg",...] rows in the payload
    expect(payload).toContain('"svg"');
    expect(payload).toContain('"path"');
    // The path data appears either inline or as a referenced Flight text row
    expect(payload).toContain(toSvgPath(encode("RSC SMOKE", { ecLevel: "M" })));
    expect(payload).toContain("server rendered");
  });

  it("encoding options (including allowKanji) also work in a Server Component", async () => {
    const { payload, errors } = await renderToFlightPayload(
      <QRCode value="漢字" ecLevel="H" allowKanji={false} />,
    );
    expect(errors).toEqual([]);
    const d = toSvgPath(encode("漢字", { ecLevel: "H", allowKanji: false }));
    expect(payload).toContain(d);
  });
});
