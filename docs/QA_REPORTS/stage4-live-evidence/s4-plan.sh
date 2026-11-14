#!/usr/bin/env bash
# Live /plan checks on the protected preview. Bypass header from a temp file, never printed.
set -u
B=${1:-https://predictiq-nt1am353d-1shot.vercel.app}; V=$B/api/v1
umask 077; H=$(mktemp); trap 'rm -f $H' EXIT
env -u VERCEL_TOKEN vercel api "/v9/projects/predictiq?teamId=team_yiqLFb6Z5UF49vvJPXyxmfs7" 2>/dev/null | jq -r '.protectionBypass|to_entries[]|select(.value.scope=="automation-bypass")|"x-vercel-protection-bypass: "+.key' | head -1 > $H
meta=$(curl -s -H @$H "$V/metadata"); mv=$(echo "$meta" | jq -r .model_version); end=$(echo "$meta" | jq -r .replay_window.end)
echo "model_version=$mv at=$end"
post(){ curl -s -H @$H -H 'content-type: application/json' -D /tmp/s4h -o /tmp/s4b -w '%{http_code} %{size_download} %{time_total}' -X POST "$V/plan?mv=$2" --data "$3"; echo " | $1 | cache-control=$(grep -i '^cache-control' /tmp/s4h | cut -d' ' -f2- | tr -d '\r') | rows=$(jq '.rows|length' /tmp/s4b 2>/dev/null) | $(date '+%H:%M:%S')"; }
MAX=$(jq -nc --arg at "$end" '{at:$at,cutoff_percent:0,include_below_cutoff:true,failure_cost:10000000,failure_cost_by_model:{model1:10000000,model2:9999999,model3:9999998,model4:9999997},planned_cost:10000000,planned_cost_by_model:{model1:10000000,model2:9999999,model3:9999998,model4:9999997},crew_slots:100,risk_reduction_percent:90}')
post "largest allowed request (100 machines listed, maximum inputs)" "$mv" "$MAX"
post "same request again (determinism check below)" "$mv" "$MAX"; cp /tmp/s4b /tmp/s4b2
post "same request a third time" "$mv" "$MAX"; cmp -s /tmp/s4b /tmp/s4b2 && echo "identical bodies: yes" || echo "identical bodies: NO"
DEF=$(jq -nc --arg at "$end" '{at:$at,failure_cost:10000,planned_cost:2500,crew_slots:5}')
post "minimal request" "$mv" "$DEF"
post "wrong model version -> expect 404" "piq-00000000-deadbeef" "$DEF"
post "crew_slots 101 -> expect 422" "$mv" "$(echo "$DEF" | jq -c '.crew_slots=101')"
post "unknown field -> expect 422" "$mv" "$(echo "$DEF" | jq -c '.extra=1')"
post "body over 4,096 bytes -> expect 413" "$mv" "$(echo "$DEF" | jq -c --arg p "$(head -c 5000 /dev/zero | tr '\0' a)" '.pad=$p')"
