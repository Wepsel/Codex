// @ts-nocheck
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { PluginOption } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const reactPlugin = react() as unknown as PluginOption;

export default defineConfig({
  plugins: [reactPlugin],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage"
    }
  }
});

