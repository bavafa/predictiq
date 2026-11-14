#!/usr/bin/env bash
# Live largest-allowed-request sizes on the protected preview. Uses the project's automation bypass
# header from a temp file (never printed). Body bytes are uncompressed (no Accept-Encoding sent).
set -u
B=${1:-https://predictiq-b1onhqk0g-1shot.vercel.app}; V=$B/api/v1
umask 077; H=$(mktemp); trap 'rm -f $H' EXIT
env -u VERCEL_TOKEN vercel api "/v9/projects/predictiq?teamId=team_yiqLFb6Z5UF49vvJPXyxmfs7" 2>/dev/null | jq -r '.protectionBypass|to_entries[]|select(.value.scope=="automation-bypass")|"x-vercel-protection-bypass: "+.key' | head -1 > $H
g(){ curl -s -H @$H -D /tmp/m1h -o /tmp/m1b -w '%{http_code} %{size_download} %{time_total}' "$1"; }
row(){ r=$(g "$2"); echo "$(date '+%H:%M:%S') | $1 | status,bytes,secs=$r | cache-control=$(grep -i '^cache-control' /tmp/m1h | cut -d' ' -f2- | tr -d '\r') | x-vercel-cache=$(grep -i '^x-vercel-cache' /tmp/m1h | cut -d' ' -f2 | tr -d '\r')"; }
g "$V/metadata" >/dev/null; meta=$(cat /tmp/m1b)
mv=$(echo "$meta" | jq -r .model_version); end=$(echo "$meta" | jq -r .replay_window.end); start=$(echo "$meta" | jq -r .replay_window.start)
echo "model_version=$mv replay=$start..$end"
row health "$V/health"
row metadata "$V/metadata"
base="mv=$mv&at=$end&cutoff=0"
row "fleet (100 machines, no filter)" "$V/fleet?$base"
row "fleet/trend (7d)" "$V/fleet/trend?$base&range=7d"
best=0; bm=0; for m in $(seq 1 100); do s=$(g "$V/assets/$m?$base" | awk '{print $2}'); [ "$s" -gt "$best" ] && { best=$s; bm=$m; }; done
row "assets/{id} (largest machine = $bm of 100 probed)" "$V/assets/$bm?$base"
row "assets/{id}/telemetry (7d)" "$V/assets/1/telemetry?mv=$mv&at=$end&range=7d"
row "assets/{id}/explanation" "$V/assets/1/explanation?mv=$mv&at=$end"
row "model/metrics" "$V/model/metrics?mv=$mv"
row "model/threshold-analysis" "$V/model/threshold-analysis?mv=$mv"
row "model/threshold-analysis (repeat)" "$V/model/threshold-analysis?mv=$mv"
row "fleet (first hour)" "$V/fleet?mv=$mv&at=$start"
row "wrong mv -> expect 404" "$V/model/metrics?mv=piq-00000000-deadbeef"
row "machine 101 -> expect 404" "$V/assets/101?$base"
row "cutoff 101 -> expect refuse" "$V/fleet?mv=$mv&at=$end&cutoff=101"
