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
#   3. WRONG HASH: a copy of the real zip with one bit flipped in place (exactly the same length, so the size cap does not
#      fire first). Expected: exit 1, "SHA-256 mismatch", nothing unpacked.
#   4. MISSING (HTTP 404) and 5. nothing listening. Expected on production: exit 1.
#   6. UNEXPECTED FILE: a copy of the real zip with the same number of members, one name replaced in place by an unexpected
#      name of the same length, hash and size patched into the copy's manifest (so the hash and file-count checks pass).
#      Expected: exit 1, "unexpected file".
#   7. SIZE CAP: the real zip with padding appended, manifest unchanged. Expected: exit 1, "larger than the allowed".
#   8. FILE COUNT: the real zip plus one extra member, hash and size patched into the copy's manifest.
#      Expected: exit 1, "more files than a bundle has".
#   9. PREVIEW: no env, no bundle. Expected: exit 0, "503" notice, no bundle.
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
buf = bytearray(open(src, "rb").read())
with zipfile.ZipFile(src) as z:
    info = z.infolist()[0]
off = info.header_offset
start = off + 30 + int.from_bytes(buf[off + 26:off + 28], "little") + int.from_bytes(buf[off + 28:off + 30], "little")
assert info.compress_size > 0
buf[start] ^= 0x01  # flip one bit of the first stored/compressed byte: same length, different hash
open(dst, "wb").write(buf)
PY
[[ "$(stat -c %s "$SERVE/tampered/bundle.zip")" -eq "$(stat -c %s "$REAL_ZIP")" ]] && pass "tampered zip has exactly the real zip's length" || fail "tampered zip length differs from the real zip"
cmp -s "$SERVE/tampered/bundle.zip" "$REAL_ZIP" && fail "tampered zip is identical to the real one" || pass "tampered zip differs from the real one"
# Size-cap case: the real zip plus trailing padding (larger than the manifest's zip_bytes).
cp "$REAL_ZIP" "$SERVE/tampered/big.zip"
head -c 4096 /dev/zero >> "$SERVE/tampered/big.zip"
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

say "3. production build, WRONG HASH (same-length zip, one bit flipped): the SHA-256 check must be what refuses it"
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

patch_manifest() { # patch_manifest <zip> <manifest>: write the zip's sha256 and length into the manifest copy
  python3 -I - "$1" "$2" <<'PY'
import hashlib, json, sys
dst, manifest = sys.argv[1:3]
data = open(dst, "rb").read()
m = json.load(open(manifest))
m["bundle"]["sha256"] = hashlib.sha256(data).hexdigest()
m["bundle"]["zip_bytes"] = len(data)
json.dump(m, open(manifest, "w"), indent=2)
PY
}

say "6. production build, same member count, one name replaced by an unexpected one (hash and size patched): unexpected-file check must refuse"
python3 -I - "$REAL_ZIP" "$SERVE/tampered/renamed.zip" <<'PY'
import sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
buf = bytearray(open(src, "rb").read())
with zipfile.ZipFile(src) as z:
    infos = z.infolist()
old = infos[-1].filename.encode()
new = (b"run-me-" + b"x" * len(old))[:len(old)]
assert new != old and len(new) == len(old)
off = infos[-1].header_offset  # local header name
assert bytes(buf[off + 30:off + 30 + len(old)]) == old
buf[off + 30:off + 30 + len(old)] = new
eocd = len(buf) - 22  # central directory entry name
assert bytes(buf[eocd:eocd + 4]) == b"PK\x05\x06"
p = int.from_bytes(buf[eocd + 16:eocd + 20], "little")
for _ in range(int.from_bytes(buf[eocd + 10:eocd + 12], "little")):
    n = int.from_bytes(buf[p + 28:p + 30], "little")
    x = int.from_bytes(buf[p + 30:p + 32], "little")
    c = int.from_bytes(buf[p + 32:p + 34], "little")
    if bytes(buf[p + 46:p + 46 + n]) == old:
        buf[p + 46:p + 46 + n] = new
    p += 46 + n + x + c
open(dst, "wb").write(buf)
with zipfile.ZipFile(dst) as z:
    assert len(z.namelist()) == len(infos) and new.decode() in z.namelist() and old.decode() not in z.namelist()
PY
patch_manifest "$SERVE/tampered/renamed.zip" "$WT/artifacts/$VERSION/manifest.json"
prebuild "$WORK/renamed.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/tampered/renamed.zip"; CODE=$?
sed 's/^/    /' "$WORK/renamed.log"
[[ $CODE -eq 1 ]] && grep -q "unexpected file" "$WORK/renamed.log" && pass "exit code 1, unexpected file refused after the hash matched" || fail "exit code $CODE (want 1 with 'unexpected file')"
grep -q "more files than a bundle has" "$WORK/renamed.log" && fail "the file-count check fired instead of the unexpected-file check"
[[ ! -e "$WT/artifacts/$VERSION/bundle" ]] && pass "nothing was unpacked" || fail "files were unpacked"
git -C "$WT" checkout -- "artifacts/$VERSION/manifest.json"

say "7. production build, download larger than the manifest's zip_bytes: size cap must refuse"
prebuild "$WORK/big.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/tampered/big.zip"; CODE=$?
sed 's/^/    /' "$WORK/big.log"
[[ $CODE -eq 1 ]] && grep -q "larger than the allowed" "$WORK/big.log" && pass "exit code 1, size cap refused the download" || fail "exit code $CODE (want 1 with 'larger than the allowed')"
[[ ! -e "$WT/artifacts/$VERSION/bundle" ]] && pass "nothing was unpacked" || fail "files were unpacked"

say "8. production build, one member too many (hash and size patched): file-count check must refuse"
python3 -I - "$REAL_ZIP" "$SERVE/tampered/extra.zip" <<'PY'
import sys, zipfile
src, dst = sys.argv[1:3]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        zout.writestr(info.filename, zin.read(info))
    zout.writestr("run-me.sh", "echo not a bundle file\n")
PY
patch_manifest "$SERVE/tampered/extra.zip" "$WT/artifacts/$VERSION/manifest.json"
prebuild "$WORK/extra.log" VERCEL_ENV=production "BUNDLE_URL=http://127.0.0.1:$PORT/tampered/extra.zip"; CODE=$?
sed 's/^/    /' "$WORK/extra.log"
[[ $CODE -eq 1 ]] && grep -q "more files than a bundle has" "$WORK/extra.log" && pass "exit code 1, file-count check refused" || fail "exit code $CODE (want 1 with 'more files than a bundle has')"
[[ ! -e "$WT/artifacts/$VERSION/bundle" ]] && pass "nothing was unpacked" || fail "files were unpacked"
git -C "$WT" checkout -- "artifacts/$VERSION/manifest.json"

say "9. preview build (no env), no bundle: must pass and say the data endpoints answer 503"
prebuild "$WORK/preview.log"; CODE=$?
sed 's/^/    /' "$WORK/preview.log"
[[ $CODE -eq 0 ]] && grep -q "503" "$WORK/preview.log" && [[ ! -e "$WT/frontend/_backend/bundle" ]] && pass "exit code 0, no bundle, 503 notice" || fail "preview behaviour changed (exit $CODE)"

say "summary"
if [[ $FAILS -eq 0 ]]; then echo "ALL CHECKS PASSED"; exit 0; else echo "$FAILS CHECK(S) FAILED"; exit 1; fi
