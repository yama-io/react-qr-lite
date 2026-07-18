/**
 * Minimal type shim for the RSC smoke test — react-server-dom-turbopack
 * ships no TypeScript types. Covers only what QRCode.rsc.test.tsx uses.
 * The import resolves only when Node's `react-server` export condition is
 * active (see vitest.workspace.ts).
 */
declare module "react-server-dom-turbopack/server.edge" {
  import type { ReactNode } from "react";

  /**
   * Renders a React Server Components tree to a Flight (RSC payload)
   * stream. The manifest is consulted only for "use client" references.
   */
  export function renderToReadableStream(
    model: ReactNode,
    turbopackManifest: unknown,
    options?: { onError?: ((error: unknown) => void) | undefined },
  ): ReadableStream<Uint8Array>;
}
