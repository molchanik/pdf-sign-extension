import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/__tests__/**/*.test.ts",
      "supabase/functions/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "~lib": resolve(__dirname, "src/lib"),
      "~components": resolve(__dirname, "src/components"),
    },
  },
})
