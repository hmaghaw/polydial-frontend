// Serves /env.js from the repo-root .env in `vite dev`, and writes it into dist on `vite build`.
// In Docker the container entrypoint (docker/40-write-env.sh) overwrites dist/env.js at start,
// so the same .env keys (API_BASE_URL, USE_MOCKS, APP_NAME) drive every mode.
import path from "node:path";
import { loadEnv, type Plugin } from "vite";

const ROOT = path.resolve(__dirname, "../..");

function render(mode: string, appName: string): string {
  const e = loadEnv(mode, ROOT, "");
  const bool = (v: string | undefined) => ["true", "1", "yes"].includes(String(v ?? "").trim().toLowerCase());
  const cfg = {
    API_BASE_URL: (e.API_BASE_URL || "https://api.polydial.com").replace(/\/+$/, ""),
    USE_MOCKS: bool(e.USE_MOCKS),
    APP_NAME: e.APP_NAME || appName,
  };
  return `window.__ENV__ = ${JSON.stringify(cfg)};\n`;
}

export function runtimeEnv(appName: string): Plugin {
  let mode = "development";
  return {
    name: "polydial-runtime-env",
    configResolved(c) { mode = c.mode; },
    configureServer(server) {
      server.watcher.add(path.join(ROOT, ".env"));
      server.middlewares.use("/env.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(render(mode, appName));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/env.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.end(render(mode, appName));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "env.js", source: render(mode, appName) });
    },
  };
}
