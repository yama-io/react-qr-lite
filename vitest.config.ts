import { configDefaults, defineConfig } from "vitest/config";

/**
 * Main (unit) suite. The RSC smoke test is excluded here: it must run in a
 * process with Node's `react-server` export condition enabled, which vitest
 * only supports via top-level poolOptions — so it has its own config
 * (vitest.rsc.config.ts) and `npm test` runs both.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.rsc.test.tsx"],
  },
});
