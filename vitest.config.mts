import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only — they run with no database and no network.
    // End-to-end coverage lives in e2e/ and runs under Playwright.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
