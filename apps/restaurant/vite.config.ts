import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { runtimeEnv } from "../../packages/shared/vite-env-plugin";
export default defineConfig({
  plugins: [react(), runtimeEnv("PolyDial Restaurant")],
  server: { port: 3001, host: true },
  preview: { port: 3001 },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
});
