// Production bundle download (decision 71; docs/DEPLOY.md). Called by sync-backend.mjs (the prebuild).
//
// On a production build (VERCEL_ENV=production) a local artifacts/<version>/bundle is never trusted: the release is always
// downloaded and verified, and replaces that folder. A non-production build that asks for it (BUNDLE_FETCH=1) downloads
// only when there is no local bundle. This downloads bundle.zip from the public GitHub release
//   https://github.com/bavafa/predictiq/releases/download/bundle-<version>/bundle.zip
// and checks it BEFORE anything is unpacked:
//   1. the download is no larger than the size in the committed manifest (or a fixed cap);
//   2. its SHA-256 equals the hash in the committed artifacts/<version>/manifest.json ("bundle" entry);
//   3. the zip holds only the allowed file names (same list as scripts/fetch_bundle.py), each once, meta.json included,
//      stored or deflated, no encryption, no zip64, no paths, each entry's inflated size and CRC match its header,
//      and the total stays under the size cap;
//   4. meta.json says "synthetic": false and its model_version is the version being deployed.
// Only then are the files written (into a staging folder, then renamed). No secret or token is used or needed.
// Node built-ins only (fetch, node:zlib, node:crypto): no zip library is added (decision 71).
//
// BUNDLE_URL overrides the URL for tests only (http is accepted only for localhost). The hash check still applies.
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, inflateRawSync } from "node:zlib";

export const REPO = "bavafa/predictiq";
// Keep in step with ALLOWED in scripts/fetch_bundle.py (backend/tests/test_deploy_layout.py checks they are equal).
export const ALLOWED = [
  "meta.json",
  "evaluation.json",
  "threshold_analysis.json",
  "records.json",
  "scores_main.npy",
  "scores_baseline.npy",
  "contrib_codes.npy",
  "contrib_values.npy",
  "contrib_other.npy",
  "telemetry.npy",
  // optional component planner files (ml/component_bundle.py COMPONENT_FILES)
  "components.json",
  "component_wear_scores.npy",
  "component_days_since.npy",
  "component_warning_scores.npy",
];
export const MAX_UNPACKED = 200 * 1024 * 1024;
export const FALLBACK_MAX_ZIP = 64 * 1024 * 1024;

export class BundleError extends Error {}

export function releaseUrl(version) {
  return `https://github.com/${REPO}/releases/download/bundle-${version}/bundle.zip`;
}

/** The newest artifacts/piq-*\/ folder that has a committed manifest with a bundle hash, or null. */
export function latestManifestVersion(artifacts) {
  if (!existsSync(artifacts)) return null;
  const versions = readdirSync(artifacts)
    .filter((n) => n.startsWith("piq-") && existsSync(join(artifacts, n, "manifest.json")))
    .sort()
    .reverse();
  return versions[0] ?? null;
}

export function expectedBundle(artifacts, version) {
  const manifest = JSON.parse(readFileSync(join(artifacts, version, "manifest.json"), "utf8"));
  const entry = manifest.bundle;
  if (!entry || typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new BundleError(`artifacts/${version}/manifest.json has no valid bundle SHA-256`);
  }
  const bytes = Number.isInteger(entry.zip_bytes) && entry.zip_bytes > 0 ? entry.zip_bytes : null;
  return { sha256: entry.sha256, zipBytes: bytes };
}

function checkUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new BundleError(`not a valid URL: ${url}`);
  }
  const local = u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    throw new BundleError("the bundle URL must be https (http only for localhost)");
  }
}

/** Download with a hard size limit; returns a Buffer. */
async function download(url, maxBytes, fetchImpl) {
  checkUrl(url);
  let res;
  try {
    res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    throw new BundleError(`download failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new BundleError(`download failed: HTTP ${res.status} from ${url}`);
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BundleError(`the download is larger than the allowed ${maxBytes} bytes`);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > maxBytes) throw new BundleError(`the download is larger than the allowed ${maxBytes} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Read and validate the zip's entries; returns [{name, data}] without writing anything. */
export function readZip(buf) {
  // End of central directory record: last 22 bytes when there is no comment (we accept none).
  const eocd = buf.length - 22;
  if (eocd < 0 || buf.readUInt32LE(eocd) !== 0x06054b50 || buf.readUInt16LE(eocd + 20) !== 0) {
    throw new BundleError("not a plain zip file (no end record, or it has a comment / zip64 data)");
  }
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new BundleError("zip64 is not accepted");
  if (count !== buf.readUInt16LE(eocd + 8) || cdOffset + cdSize > eocd) throw new BundleError("damaged zip directory");
  if (count > ALLOWED.length) throw new BundleError("the zip holds more files than a bundle has");

  const headers = [];
  const seen = new Set();
  let p = cdOffset;
  let declaredTotal = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > eocd || buf.readUInt32LE(p) !== 0x02014b50) throw new BundleError("damaged zip directory");
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (!ALLOWED.includes(name)) throw new BundleError(`unexpected file in the zip: ${JSON.stringify(name)}`);
    if (seen.has(name)) throw new BundleError(`file listed twice in the zip: ${name}`);
    seen.add(name);
    if (flags & 1) throw new BundleError("encrypted zip entries are not accepted");
    if (method !== 0 && method !== 8) throw new BundleError(`unsupported compression for ${name}`);
    if (csize === 0xffffffff || usize === 0xffffffff || lho === 0xffffffff) throw new BundleError("zip64 is not accepted");
    declaredTotal += usize;
    if (declaredTotal > MAX_UNPACKED) throw new BundleError("the zip would unpack to more than the size limit");
    if (lho + 30 > cdOffset || buf.readUInt32LE(lho) !== 0x04034b50) throw new BundleError("damaged zip entry");
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    if (start + csize > cdOffset) throw new BundleError("damaged zip entry");
    headers.push({ name, method, crc, usize, raw: buf.subarray(start, start + csize) });
  }
  // Nothing is inflated until every header has passed (names, total declared size).
  const entries = [];
  for (const { name, method, crc, usize, raw } of headers) {
    let data;
    try {
      data = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: Math.max(usize, 1) });
    } catch {
      throw new BundleError(`could not unpack ${name} (damaged, or larger than its header says)`);
    }
    if (data.length !== usize) throw new BundleError(`${name}: unpacked size does not match the zip header`);
    if (crc32(data) !== crc) throw new BundleError(`${name}: CRC does not match`);
    entries.push({ name, data });
  }
  if (!seen.has("meta.json")) throw new BundleError("the zip has no meta.json");
  return entries;
}

/**
 * Make artifacts/<version>/bundle available when it is not there and the environment asks for it.
 * Returns {action: "present" | "skipped" | "fetched", version}. Throws BundleError when a required fetch fails.
 * On VERCEL_ENV=production a local bundle folder is never trusted: the release is always downloaded, verified and replaces it.
 * Otherwise an existing local bundle is left as it is ("present").
 */
export async function ensureBundle({ artifacts, env = process.env, fetchImpl = globalThis.fetch }) {
  const version = latestManifestVersion(artifacts);
  const production = env.VERCEL_ENV === "production";
  const requested = production || env.BUNDLE_FETCH === "1";
  // Production never trusts a local bundle folder: it may be stale or tampered with. It always downloads, verifies the
  // SHA-256 against the committed manifest, and replaces any existing folder with the freshly unpacked, verified files.
  // Other builds keep a local bundle as fetched and verified by scripts/fetch_bundle.py.
  if (!production && version && existsSync(join(artifacts, version, "bundle", "meta.json"))) return { action: "present", version };
  if (!requested) return { action: "skipped", version };
  if (!version) throw new BundleError("no committed artifacts/piq-*/manifest.json: cannot tell which bundle to download");

  const { sha256, zipBytes } = expectedBundle(artifacts, version);
  const url = env.BUNDLE_URL || releaseUrl(version);
  console.log(`fetch-bundle: downloading the bundle for ${version} from ${url}`);
  const zip = await download(url, zipBytes ?? FALLBACK_MAX_ZIP, fetchImpl);
  const got = createHash("sha256").update(zip).digest("hex");
  if (got !== sha256) {
    throw new BundleError(`SHA-256 mismatch: the manifest says ${sha256}, the download is ${got}. Nothing was unpacked.`);
  }
  const entries = readZip(zip);
  const meta = JSON.parse(entries.find((e) => e.name === "meta.json").data.toString("utf8"));
  if (meta.synthetic !== false) throw new BundleError('REFUSING: the bundle\'s meta.json is not marked "synthetic": false');
  if (meta.model_version !== version) throw new BundleError("REFUSING: the bundle's model_version is not the version being deployed");

  const versionDir = join(artifacts, version);
  const staging = mkdtempSync(join(versionDir, ".bundle-"));
  try {
    for (const e of entries) writeFileSync(join(staging, e.name), e.data);
    rmSync(join(versionDir, "bundle"), { recursive: true, force: true });
    renameSync(staging, join(versionDir, "bundle"));
  } catch (e) {
    rmSync(staging, { recursive: true, force: true });
    throw e;
  }
  console.log(`fetch-bundle: SHA-256 matched; unpacked ${entries.length} files to artifacts/${version}/bundle`);
  return { action: "fetched", version };
}
