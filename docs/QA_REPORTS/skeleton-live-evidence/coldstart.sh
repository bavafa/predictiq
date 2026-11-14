#!/usr/bin/env bash
# Cold start by fresh preview redeploys: redeploy the skeleton preview (target preview), then the
# first request to /api/v1/health (no-store, always reaches the function) is the cold sample,
# followed by one warm sample.
cd /tmp/vc
SRC=dpl_F3TKrVrK6hGmpcHBAQiVJtQkAecz
for i in $(seq 1 ${N:-10}); do
  url=$(env -u VERCEL_TOKEN vercel redeploy $SRC --target preview --scope 1shot 2>/dev/null | grep -Eo 'https://predictiq-[a-z0-9]+-1shot\.vercel\.app' | tail -1)
  [ -z "$url" ] && { echo "run $i redeploy failed"; continue; }
  for kind in cold warm; do
    out=$(env -u VERCEL_TOKEN vercel curl /api/v1/health --deployment "$url" --scope 1shot -- -sS -D - -o /dev/null -w 'TIME_TOTAL=%{time_total} TTFB=%{time_starttransfer}\n' 2>&1)
    st=$(echo "$out" | grep -m1 '^HTTP' | awk '{print $2}')
    echo "$(date '+%H:%M:%S') run=$i $kind $url status=$st $(echo "$out" | grep TIME_TOTAL)"
  done
done
