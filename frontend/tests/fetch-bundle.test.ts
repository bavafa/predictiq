// @vitest-environment node
// Production bundle download (scripts/fetch-bundle.mjs, called by the prebuild; decision 71).
// A tiny zip writer builds the test archives; no network is used (a fake fetch, or a refused local port).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error plain .mjs module without types
import { ALLOWED, BundleError, ensureBundle, releaseUrl } from "../scripts/fetch-bundle.mjs";

const VERSION = "piq-20260101-abcd1234";
const SYNC = join(__dirname, "..", "scripts", "sync-backend.mjs");

function makeZip(files: Record<string, Buffer | string>, opts: { method?: 0 | 8 } = {}): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const method = opts.method ?? 8;
    const packed = method === 8 ? deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc32(data), 14);
    lh.writeUInt32LE(packed.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    parts.push(lh, nameBuf, packed);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc32(data), 16);
    ch.writeUInt32LE(packed.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const goodMeta = JSON.stringify({ synthetic: false, model_version: VERSION });
const goodFiles = (): Record<string, string> => ({ "meta.json": goodMeta, "scores_main.npy": "numbers" });
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const PROD = { VERCEL_ENV: "production" };

let root: string;
let artifacts: string;

function writeManifest(zip: Buffer, zipBytes: number = zip.length) {
  mkdirSync(join(artifacts, VERSION), { recursive: true });
  writeFileSync(
    join(artifacts, VERSION, "manifest.json"),
    JSON.stringify({ bundle: { file: "bundle.zip", sha256: sha(zip), zip_bytes: zipBytes } }),
  );
}

function serving(body: Buffer | null, status = 200) {
  return vi.fn(async () =>
    body === null ? new Response("nope", { status }) : new Response(new Uint8Array(body), { status }),
  );
}

/** Rewrite every 4-byte little-endian field equal to `from` (the size fields) to `to`. */
function patchSizes(zip: Buffer, from: number, to: number): Buffer {
  const out = Buffer.from(zip);
  for (let i = 0; i + 4 <= out.length; i++) if (out.readUInt32LE(i) === from) out.writeUInt32LE(to, i);
  return out;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fetch-bundle-"));
  artifacts = join(root, "artifacts");
  mkdirSync(artifacts);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("ensureBundle", () => {
  it("downloads, checks the hash, and unpacks a good zip", async () => {
    const zip = makeZip(goodFiles());
    writeManifest(zip);
    const fetchImpl = serving(zip);
    const r = await ensureBundle({ artifacts, env: PROD, fetchImpl });
    expect(r).toEqual({ action: "fetched", version: VERSION });
    expect(fetchImpl).toHaveBeenCalledWith(releaseUrl(VERSION), expect.anything());
    expect(releaseUrl(VERSION)).toBe(
      `https://github.com/bavafa/predictiq/releases/download/bundle-${VERSION}/bundle.zip`,
    );
    expect(readdirSync(join(artifacts, VERSION, "bundle")).sort()).toEqual(["meta.json", "scores_main.npy"]);
    expect(readdirSync(join(artifacts, VERSION)).some((n) => n.startsWith(".bundle-"))).toBe(false);
  });

  it("also unpacks stored (uncompressed) entries, when BUNDLE_FETCH=1", async () => {
    const zip = makeZip(goodFiles(), { method: 0 });
    writeManifest(zip);
    await ensureBundle({ artifacts, env: { BUNDLE_FETCH: "1" }, fetchImpl: serving(zip) });
    expect(existsSync(join(artifacts, VERSION, "bundle", "scores_main.npy"))).toBe(true);
  });

  it("refuses a wrong hash before unpacking anything", async () => {
    const zip = makeZip(goodFiles());
    const other = makeZip({ ...goodFiles(), "scores_main.npy": "different" });
    writeManifest(zip, other.length + 100); // size cap is not the reason for the refusal
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(other) })).rejects.toThrow(
      /SHA-256 mismatch/,
    );
    expect(readdirSync(join(artifacts, VERSION))).toEqual(["manifest.json"]);
  });

  it("refuses an unexpected file name even when the hash is right", async () => {
    for (const name of ["evil.sh", "../escape.json", "sub/meta.json"]) {
      const zip = makeZip({ ...goodFiles(), [name]: "x" });
      writeManifest(zip);
      await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(zip) })).rejects.toThrow(
        /unexpected file/,
      );
      expect(existsSync(join(artifacts, VERSION, "bundle"))).toBe(false);
    }
    expect(existsSync(join(root, "escape.json"))).toBe(false);
  });

  it("refuses a zip with no meta.json", async () => {
    const zip = makeZip({ "scores_main.npy": "x" });
    writeManifest(zip);
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(zip) })).rejects.toThrow(/no meta.json/);
  });

  it("refuses an oversize download (larger than the manifest's zip size)", async () => {
    const zip = makeZip(goodFiles());
    writeManifest(zip);
    const big = Buffer.concat([zip, Buffer.alloc(5000)]);
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(big) })).rejects.toThrow(/larger than/);
    expect(existsSync(join(artifacts, VERSION, "bundle"))).toBe(false);
  });

  it("refuses a zip that inflates to more than its header says (zip bomb)", async () => {
    const zip = makeZip({ "meta.json": goodMeta, "scores_main.npy": "a".repeat(100_000) });
    const bad = patchSizes(zip, 100_000, 10);
    writeManifest(bad);
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(bad) })).rejects.toThrow(
      /could not unpack|does not match/,
    );
    expect(existsSync(join(artifacts, VERSION, "bundle"))).toBe(false);
  });

  it("refuses a bundle whose declared total size is over the cap", async () => {
    const zip = makeZip({ "meta.json": goodMeta, "scores_main.npy": "a".repeat(777) });
    const bad = patchSizes(patchSizes(zip, 777, 150 * 1024 * 1024), goodMeta.length, 150 * 1024 * 1024);
    writeManifest(bad);
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(bad) })).rejects.toThrow(/size limit/);
  });

  it("refuses a synthetic bundle, an unmarked one, and one for another version", async () => {
    for (const meta of [
      { synthetic: true, model_version: VERSION },
      { model_version: VERSION },
      { synthetic: false, model_version: "piq-19990101-00000000" },
    ]) {
      const zip = makeZip({ "meta.json": JSON.stringify(meta), "scores_main.npy": "x" });
      writeManifest(zip);
      await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(zip) })).rejects.toThrow(/REFUSING/);
      expect(existsSync(join(artifacts, VERSION, "bundle"))).toBe(false);
    }
  });

  it("fails on production when the release is missing (HTTP 404) or the network is down", async () => {
    writeManifest(makeZip(goodFiles()));
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(null, 404) })).rejects.toThrow(
      /HTTP 404/,
    );
    const down = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: down })).rejects.toBeInstanceOf(BundleError);
  });

  it("fails on production when there is no committed manifest at all", async () => {
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(null) })).rejects.toThrow(/manifest/);
  });

  it("does nothing on a preview or a local build: no download, no error", async () => {
    writeManifest(makeZip(goodFiles()));
    const fetchImpl = serving(null, 500);
    for (const env of [{}, { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }]) {
      expect((await ensureBundle({ artifacts, env, fetchImpl })).action).toBe("skipped");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("leaves an existing local bundle alone on a non-production build (BUNDLE_FETCH=1 too)", async () => {
    writeManifest(makeZip(goodFiles()));
    mkdirSync(join(artifacts, VERSION, "bundle"));
    writeFileSync(join(artifacts, VERSION, "bundle", "meta.json"), goodMeta);
    for (const env of [{}, { BUNDLE_FETCH: "1" }]) {
      const fetchImpl = serving(null, 500);
      expect((await ensureBundle({ artifacts, env, fetchImpl })).action).toBe("present");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("production never trusts an existing (even tampered) local bundle: it downloads, verifies and replaces it", async () => {
    const zip = makeZip(goodFiles());
    writeManifest(zip);
    mkdirSync(join(artifacts, VERSION, "bundle"));
    writeFileSync(join(artifacts, VERSION, "bundle", "meta.json"), goodMeta);
    writeFileSync(join(artifacts, VERSION, "bundle", "scores_main.npy"), "TAMPERED");
    writeFileSync(join(artifacts, VERSION, "bundle", "extra.sh"), "echo hi");
    const fetchImpl = serving(zip);
    const r = await ensureBundle({ artifacts, env: PROD, fetchImpl });
    expect(r.action).toBe("fetched");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(readdirSync(join(artifacts, VERSION, "bundle")).sort()).toEqual(["meta.json", "scores_main.npy"]);
    expect(readFileSync(join(artifacts, VERSION, "bundle", "scores_main.npy"), "utf8")).toBe("numbers");
    expect(readdirSync(join(artifacts, VERSION)).some((n) => n.startsWith(".bundle-"))).toBe(false);
  });

  it("production with an existing local bundle and a failed download fails (the local folder is not used)", async () => {
    writeManifest(makeZip(goodFiles()));
    mkdirSync(join(artifacts, VERSION, "bundle"));
    writeFileSync(join(artifacts, VERSION, "bundle", "meta.json"), goodMeta);
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(null, 500) })).rejects.toThrow(/HTTP 500/);
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: down })).rejects.toBeInstanceOf(BundleError);
    // A hash mismatch also fails, and the existing folder is not replaced by the refused download.
    const other = makeZip({ ...goodFiles(), "scores_main.npy": "numbert" });
    await expect(ensureBundle({ artifacts, env: PROD, fetchImpl: serving(other) })).rejects.toThrow(/SHA-256 mismatch/);
  });

  it("accepts http only for localhost in BUNDLE_URL", async () => {
    const zip = makeZip(goodFiles());
    writeManifest(zip);
    await expect(
      ensureBundle({
        artifacts,
        env: { ...PROD, BUNDLE_URL: "http://example.com/bundle.zip" },
        fetchImpl: serving(zip),
      }),
    ).rejects.toThrow(/https/);
    const ok = serving(zip);
    await ensureBundle({ artifacts, env: { ...PROD, BUNDLE_URL: "http://127.0.0.1:9/bundle.zip" }, fetchImpl: ok });
    expect(ok).toHaveBeenCalled();
  });

  it("allows exactly fourteen distinct file names (ten machine files, four component files)", () => {
    expect(ALLOWED).toHaveLength(14);
    expect(new Set(ALLOWED).size).toBe(14);
  });
});

describe("the prebuild script (sync-backend.mjs) as a process", () => {
  function run(env: Record<string, string>) {
    const backend = join(root, "backend");
    mkdirSync(join(backend, "app"), { recursive: true });
    writeFileSync(join(backend, "app", "main.py"), "# app");
    writeManifest(makeZip(goodFiles()));
    const baseEnv: NodeJS.ProcessEnv = { ...process.env };
    delete baseEnv.VERCEL_ENV;
    delete baseEnv.BUNDLE_FETCH;
    delete baseEnv.BUNDLE_URL;
    return spawnSync(
      "node",
      [SYNC, "--backend", backend, "--artifacts", artifacts, "--out", join(root, "out")],
      { env: { ...baseEnv, ...env }, encoding: "utf8" },
    );
  }

  it("production with a missing bundle FAILS the build (exit 1)", () => {
    const r = run({ VERCEL_ENV: "production", BUNDLE_URL: "http://127.0.0.1:9/bundle.zip" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/download failed/);
    expect(existsSync(join(root, "out", "bundle"))).toBe(false);
  });

  it("a preview with a missing bundle passes and says the data answers 503", () => {
    const r = run({ VERCEL_ENV: "preview" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/503/);
    expect(existsSync(join(root, "out", "app", "main.py"))).toBe(true);
  });

  it("no env at all (a local build) passes", () => {
    expect(run({}).status).toBe(0);
  });
});
