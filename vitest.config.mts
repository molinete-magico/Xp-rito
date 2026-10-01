import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Os matchers do jest-dom (toHaveTextContent, toHaveAttribute, …) ficam
    // disponíveis em todo lugar, e não só nos arquivos de componente.
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});