import { defineConfig } from "vitest/config";

/**
 * RSC smoke-test suite (see src/QRCode.rsc.test.tsx).
 *
 * `resolve.conditions` enables the `react-server` export condition — the
 * module resolution RSC runtimes (Next.js App Router, etc.) use — in both
 * places it matters: vite-node resolves the test file's own imports with
 * it, and vitest forwards it to the worker process as a node --conditions
 * flag so the Flight renderer's internal require("react") agrees. `react`
 * then resolves to its server subset (no useState/useEffect) everywhere.
 */
export default defineConfig({
  resolve: {
    conditions: ["react-server"],
  },
  test: {
    include: ["src/**/*.rsc.test.tsx"],
    pool: "forks",
  },
});
