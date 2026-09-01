import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/domain/**/*.test.ts",
      "src/content/**/*.test.ts",
      "src/features/**/*.test.ts",
      "src/routes/**/*.test.ts",
    ],
  },
});
