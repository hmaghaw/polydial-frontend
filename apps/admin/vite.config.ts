import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { runtimeEnv } from "../../packages/shared/vite-env-plugin";
export default defineConfig({
  plugins: [react(), runtimeEnv("PolyDial Admin")],
  server: { port: 3000, host: true },
  preview: { port: 3000 },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
});
