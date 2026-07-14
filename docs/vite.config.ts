import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// The site is served from https://yama-io.github.io/react-qr-lite/
export default defineConfig({
  base: "/react-qr-lite/",
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      // Resolve the library straight from the repository sources so the
      // docs (and the Playground) always reflect the current code without
      // requiring a prior `npm run build` at the repo root.
      "react-qr-lite/core": fileURLToPath(
        new URL("../src/core/index.ts", import.meta.url),
      ),
      "react-qr-lite": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
    // The repo root has its own react in node_modules (devDependency);
    // force a single copy so hooks work.
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: {
      // Allow serving ../src (the library sources) in dev mode.
      allow: [".."],
    },
  },
});
