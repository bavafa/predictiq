// End-to-end runner. Playwright runs against a REAL stack: FastAPI (uvicorn) serving a bundle, plus Next.js
// (`next start`) proxying /api/v1 to it with API_PROXY_URL. Nothing is mocked.
//
//   node scripts/e2e.mjs            synthetic test bundle (what CI runs), then the no-model-data checks
//   node scripts/e2e.mjs --real     the real local bundle in artifacts/<version>/bundle (opt-in; skips if absent)
//
// The web build bakes the proxy address in, so this script builds first (it overwrites .next).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(frontend, "..");
const apiPort = process.env.E2E_API_PORT ?? "8765";
const env = { ...process.env, E2E_API_PORT: apiPort, API_PROXY_URL: `http://127.0.0.1:${apiPort}` };

function run(cmd, args, options) {
  const res = spawnSync(cmd, args, { stdio: "inherit", env, ...options });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function realBundle() {
  const artifacts = join(repo, "artifacts");
  if (!existsSync(artifacts)) return null;
  for (const name of readdirSync(artifacts).sort().reverse()) {
    const meta = join(artifacts, name, "bundle", "meta.json");
    if (name.startsWith("piq-") && existsSync(meta) && JSON.parse(readFileSync(meta, "utf8")).synthetic === false) {
      return dirname(meta);
    }
  }
  return null;
}

const real = process.argv.includes("--real");
const extra = process.argv.slice(2).filter((a) => a !== "--real");
const playwright = (mode, bundle) =>
  run("npx", ["playwright", "test", ...extra], { cwd: frontend, env: { ...env, E2E_MODE: mode, E2E_BUNDLE_DIR: bundle } });

if (real) {
  const bundle = realBundle();
  if (!bundle) {
    console.error("No real bundle in artifacts/ (run scripts/fetch_bundle.py or build_bundle.py). Nothing to run.");
    process.exit(1);
  }
  run("npm", ["run", "build"], { cwd: frontend });
  playwright("real", bundle);
} else {
  const synthetic = join(frontend, ".e2e", "bundle");
  run("uv", ["run", "--group", "ml", "python", "-m", "scripts.make_synthetic_bundle", synthetic], { cwd: repo });
  run("npm", ["run", "build"], { cwd: frontend });
  playwright("synthetic", synthetic);
  // No bundle at all: the server must say so plainly. The path does not exist, which means "no bundle".
  playwright("none", join(frontend, ".e2e", "no-bundle-here"));
}
