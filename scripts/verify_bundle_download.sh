#!/usr/bin/env bash
# Local end-to-end proof of the production bundle download (decision 71). Nothing is deployed; no network beyond localhost.
#
#   scripts/verify_bundle_download.sh
#
# Needs the real artifacts/<version>/bundle.zip on this machine (built by scripts/build_bundle.py or fetched).
# Steps:
#   1. A clean git worktree of HEAD is made, then the current non-ignored files of this working tree are copied over it
#      (so uncommitted work is tested too). It has no artifacts/<version>/bundle and no node_modules.
#   2. The real bundle.zip is served from a throw-away localhost HTTP server.
#   3. The prebuild (`npm run prebuild`, i.e. frontend/scripts/sync-backend.mjs) runs there with VERCEL_ENV=production
#      and BUNDLE_URL pointing at the server. Expected: exit 0, the ten files unpacked, byte-identical to the local bundle,
#      the zip's SHA-256 equal to the committed manifest.
#   4. WRONG HASH: a repacked zip (one file changed) is served. Expected: exit 1, "SHA-256 mismatch", nothing unpacked.
#   5. MISSING: nothing is listening. Expected on production: exit 1.
#   6. UNEXPECTED FILE: the real zip plus one extra file, hash patched into the copy's manifest. Expected: exit 1, "unexpected file".
#   7. PREVIEW: no env, no bundle. Expected: exit 0, "503" notice, no bundle.
# Exit code 0 only if every expectation held.
set -uo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/predictiq-bundle-dl.XXXXXX")"
WT="$WORK/tree"
SERVE="$WORK/serve"
FAILS=0
SERVER_PID=""

cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null
  git -C "$SRC" worktree remove --force "$WT" 2>/dev/null
  git -C "$SRC" worktree prune
  rm -rf "$WORK"
}
trap cleanup EXIT

say() { printf '\n== %s\n' "$*"; }
pass() { printf 'PASS: %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*"; FAILS=$((FAILS + 1)); }

VERSION="$(ls "$SRC/artifacts" | grep '^piq-' | sort | tail -1)"
REAL_ZIP="$SRC/artifacts/$VERSION/bundle.zip"
[[ -f "$REAL_ZIP" ]] || { echo "No $REAL_ZIP: build or fetch the real bundle first."; exit 2; }
echo "version: $VERSION"
echo "node: $(node -v)"
WANT="$(python3 -I -c "import json,sys; print(json.load(open(sys.argv[1]))['bundle']['sha256'])" "$SRC/artifacts/$VERSION/manifest.json")"
GOT="$(sha256sum "$REAL_ZIP" | cut -d' ' -f1)"
echo "manifest sha256: $WANT"
echo "bundle.zip sha256: $GOT"
[[ "$WANT" == "$GOT" ]] && pass "the local bundle.zip matches the committed manifest" || fail "local zip does not match the manifest"

say "1. clean worktree of HEAD plus the current non-ignored working-tree files"
git -C "$SRC" worktree add --detach "$WT" HEAD >/dev/null 2>&1 || { echo "git worktree failed"; exit 2; }
(cd "$SRC" && git ls-files -co --exclude-standard -z) | while IFS= read -r -d '' f; do
  if [[ -e "$SRC/$f" ]]; then mkdir -p "$WT/$(dirname "$f")"; cp -p "$SRC/$f" "$WT/$f"; fi
done
if ls "$WT/artifacts/$VERSION/bundle" >/dev/null 2>&1; then fail "worktree unexpectedly has a bundle"; else pass "worktree has no artifacts/$VERSION/bundle"; fi
[[ -e "$WT/frontend/node_modules" ]] && fail "worktree has node_modules" || pass "worktree has no node_modules (the prebuild uses Node built-ins only)"

# Free port.
PORT="$(python3 -I -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()")"
mkdir -p "$SERVE/good" "$SERVE/tampered"
cp "$REAL_ZIP" "$SERVE/good/bundle.zip"
python3 -I - "$REAL_ZIP" "$SERVE/tampered/bundle.zip" <<'PY'
import sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        data = zin.read(info)
        if info.filename == "records.json":
            data = data + b" "  # one byte differs: the hash must differ
        zout.writestr(info.filename, data)
PY
python3 -I -m http.server "$PORT" --bind 127.0.0.1 --directory "$SERVE" >"$WORK/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 50); do curl -fs "http://127.0.0.1:$PORT/good/bundle.zip" -o /dev/null && break; sleep 0.1; done
echo "local server on 127.0.0.1:$PORT (pid $SERVER_PID)"

prebuild() { # prebuild <logfile> [VAR=value ...]
  local log="$1"; shift
  (cd "$WT/frontend" && env -u VERCEL_ENV -u BUNDLE_FETCH -u BUNDLE_URL "$@" npm run --silent prebuild) >"$log" 2>&1
}

say "2. production build, good zip: must unpack and match"
prebuild "$WORK/good.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/good/bundle.zip"; CODE=$?
sed 's/^/    /' "$WORK/good.log"
[[ $CODE -eq 0 ]] && pass "prebuild exit code 0" || fail "prebuild exit code $CODE (want 0)"
grep -q "SHA-256 matched" "$WORK/good.log" && pass "log says the SHA-256 matched" || fail "no 'SHA-256 matched' line"
N="$(ls "$WT/frontend/_backend/bundle" 2>/dev/null | wc -l)"
[[ "$N" -eq 10 ]] && pass "10 files copied to frontend/_backend/bundle (the function's bundle folder)" || fail "$N files in _backend/bundle (want 10)"
SAME=1
for f in "$SRC/artifacts/$VERSION/bundle/"*; do cmp -s "$f" "$WT/frontend/_backend/bundle/$(basename "$f")" || { SAME=0; echo "differs: $(basename "$f")"; }; done
[[ $SAME -eq 1 ]] && pass "every unpacked file is byte-identical to the local bundle" || fail "unpacked files differ from the local bundle"
UNP="$(cd "$WT/artifacts/$VERSION/bundle" && cat $(ls | sort) | sha256sum | cut -c1-16)"
LOC="$(cd "$SRC/artifacts/$VERSION/bundle" && cat $(ls | sort) | sha256sum | cut -c1-16)"
[[ "$UNP" == "$LOC" ]] && pass "combined content hash of the unpacked folder equals the local one ($UNP)" || fail "combined hash differs"
ls "$WT/artifacts/$VERSION" | grep -q '^\.bundle-' && fail "staging folder left behind" || pass "no staging folder left behind"
rm -rf "$WT/frontend/_backend" "$WT/artifacts/$VERSION/bundle"

say "3. production build, WRONG HASH (repacked zip, one byte changed): must fail"
prebuild "$WORK/bad.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/tampered/bundle.zip"; CODE=$?
sed 's/^/    /' "$WORK/bad.log"
[[ $CODE -eq 1 ]] && pass "prebuild exit code 1" || fail "prebuild exit code $CODE (want 1)"
grep -q "SHA-256 mismatch" "$WORK/bad.log" && pass "log says SHA-256 mismatch" || fail "no mismatch message"
[[ ! -e "$WT/artifacts/$VERSION/bundle" && ! -e "$WT/frontend/_backend/bundle" ]] && pass "nothing was unpacked" || fail "files were unpacked after a hash mismatch"

say "4. production build, release missing (HTTP 404): must fail"
prebuild "$WORK/404.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/no-such/bundle.zip"; CODE=$?
sed 's/^/    /' "$WORK/404.log"
[[ $CODE -eq 1 ]] && grep -q "HTTP 404" "$WORK/404.log" && pass "exit code 1 with HTTP 404" || fail "exit code $CODE (want 1 with HTTP 404)"

say "5. production build, nothing listening: must fail"
prebuild "$WORK/down.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:9/bundle.zip"; CODE=$?
sed 's/^/    /' "$WORK/down.log"
[[ $CODE -eq 1 ]] && pass "exit code 1" || fail "exit code $CODE (want 1)"

say "6. production build, real zip plus one unexpected file (hash patched into the copy's manifest): must fail"
python3 -I - "$REAL_ZIP" "$SERVE/tampered/extra.zip" "$WT/artifacts/$VERSION/manifest.json" <<'PY'
import hashlib, json, sys, zipfile
src, dst, manifest = sys.argv[1:4]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        zout.writestr(info.filename, zin.read(info))
    zout.writestr("run-me.sh", "echo not a bundle file\n")
data = open(dst, "rb").read()
m = json.load(open(manifest))
m["bundle"]["sha256"] = hashlib.sha256(data).hexdigest()
m["bundle"]["zip_bytes"] = len(data)
json.dump(m, open(manifest, "w"), indent=2)
PY
prebuild "$WORK/extra.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/tampered/extra.zip"; CODE=$?
sed 's/^/    /' "$WORK/extra.log"
[[ $CODE -eq 1 ]] && grep -q "unexpected file" "$WORK/extra.log" && pass "exit code 1, unexpected file refused after the hash matched" || fail "exit code $CODE (want 1 with 'unexpected file')"
[[ ! -e "$WT/artifacts/$VERSION/bundle" ]] && pass "nothing was unpacked" || fail "files were unpacked"
git -C "$WT" checkout -- "artifacts/$VERSION/manifest.json"

say "7. preview build (no env), no bundle: must pass and say the data endpoints answer 503"
prebuild "$WORK/preview.log"; CODE=$?
sed 's/^/    /' "$WORK/preview.log"
[[ $CODE -eq 0 ]] && grep -q "503" "$WORK/preview.log" && [[ ! -e "$WT/frontend/_backend/bundle" ]] && pass "exit code 0, no bundle, 503 notice" || fail "preview behaviour changed (exit $CODE)"

say "summary"
if [[ $FAILS -eq 0 ]]; then echo "ALL CHECKS PASSED"; exit 0; else echo "$FAILS CHECK(S) FAILED"; exit 1; fi
