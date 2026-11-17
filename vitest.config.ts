import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({ resolve: { alias: { "@": resolve(__dirname, "src") } }, test: { environment: "node", maxWorkers: 1, include: ["tests/**/*.test.ts"] } });
