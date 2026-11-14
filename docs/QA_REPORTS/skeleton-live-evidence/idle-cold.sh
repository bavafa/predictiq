#!/usr/bin/env bash
# Cold start by idle spacing: one request to /api/v1/health (no-store, always reaches the
# function) every GAP seconds with no other API traffic in between, then one immediate warm request.
GAP=${GAP:-720}
for i in $(seq 1 ${N:-10}); do
  sleep $GAP
  c=$(/workspace/predictiq-logs/live/vcurl.sh /api/v1/health)
  w=$(/workspace/predictiq-logs/live/vcurl.sh /api/v1/health)
  echo "run=$i idle_s=$GAP COLD $c"
  echo "run=$i WARM $w"
done
echo DONE
