import { cp, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "@react-router/dev/config";

export default {
  // Static site generation: no runtime server, every route is prerendered
  // to plain HTML at build time (GitHub Pages serves the output as-is).
  ssr: false,
  prerender: true,
  // The site lives at https://yama-io.github.io/react-qr-lite/
  basename: "/react-qr-lite/",

  // Prerendered HTML lands in build/client/react-qr-lite/** (the basename is
  // included in the file paths) while assets stay in build/client/assets/**.
  // GitHub Pages serves the artifact root AT /react-qr-lite/, so lift the
  // HTML up to the root, and keep the SPA fallback as 404.html so unknown
  // URLs still hydrate into the app (and show the not-found route).
  async buildEnd() {
    const client = fileURLToPath(new URL("./build/client", import.meta.url));
    const nested = join(client, "react-qr-lite");
    await rename(join(client, "index.html"), join(client, "404.html"));
    await cp(nested, client, { recursive: true, force: true });
    await rm(nested, { recursive: true, force: true });
  },
} satisfies Config;
