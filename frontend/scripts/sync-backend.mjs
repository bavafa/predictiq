// Prebuild step. Copies, for the Vercel Python function:
//   ../backend/app                      -> _backend/app     (backend/ stays the only source)
//   ../artifacts/<latest>/bundle         -> _backend/bundle  (only if present; never a synthetic one)
// If there is no local bundle and the build is a production build (VERCEL_ENV=production) or BUNDLE_FETCH=1, the bundle is
// first downloaded from the public release and verified (fetch-bundle.mjs, decision 71). On production a missing,
// failed or mismatched bundle FAILS the build. Without those variables (previews, local builds) nothing is downloaded.
// _backend/ is generated and git-ignored.
//
// Options (used by the tests): --backend <dir> --artifacts <dir> --out <dir>
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BundleError, ensureBundle } from "./fetch-bundle.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "..");

function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? resolve(process.argv[i + 1]) : fallback;
}

const backend = option("backend", resolve(frontend, "..", "backend"));
const artifacts = option("artifacts", resolve(frontend, "..", "artifacts"));
const out = option("out", join(frontend, "_backend"));

/** The newest artifacts/piq-*\/bundle that has a meta.json, or null. */
function latestBundle(root) {
  if (!existsSync(root)) return null;
  const versions = readdirSync(root)
    .filter((n) => n.startsWith("piq-"))
    .sort()
    .reverse();
  for (const v of versions) {
    const dir = join(root, v, "bundle");
    if (existsSync(join(dir, "meta.json"))) return { version: v, dir };
  }
  return null;
}

try {
  await ensureBundle({ artifacts });
} catch (e) {
  if (!(e instanceof BundleError)) throw e;
  console.error(`sync-backend: ${e.message}`);
  console.error("sync-backend: the bundle is required for this build, so the build stops here. Nothing is deployed without model data.");
  process.exit(1);
}

const found = latestBundle(artifacts);
if (found) {
  const meta = JSON.parse(readFileSync(join(found.dir, "meta.json"), "utf8"));
  if (meta.synthetic !== false) {
    console.error(
      `sync-backend: REFUSING to copy ${found.dir}: its meta.json is not marked "synthetic": false. ` +
        "A synthetic (test) bundle must never be deployed. Rebuild or fetch the real bundle.",
    );
    process.exit(1);
  }
  if (meta.model_version !== found.version) {
    console.error(`sync-backend: REFUSING ${found.dir}: meta.json model_version does not match the folder name.`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
cpSync(join(backend, "app"), join(out, "app"), {
  recursive: true,
  filter: (src) => !src.includes("__pycache__"),
});
console.log(`synced ${backend}/app -> ${out}/app`);
if (found) {
  cpSync(found.dir, join(out, "bundle"), { recursive: true });
  console.log(`synced bundle ${found.version} -> ${out}/bundle`);
} else {
  console.log("no bundle found under artifacts/: the data endpoints will answer 503 (no data is faked)");
}
