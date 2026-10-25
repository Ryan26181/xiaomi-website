import { defineConfig } from "vitest/config";

// Tauri expects a fixed port and fails if it is taken.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
