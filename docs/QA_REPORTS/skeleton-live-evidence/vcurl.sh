#!/usr/bin/env bash
# usage: vcurl.sh <path> ; prints status, selected headers, time and size on one line
cd /tmp/vc
out=$(env -u VERCEL_TOKEN vercel curl "$1" --deployment https://predictiq-git-skeleton-1shot.vercel.app --scope 1shot -- -sS -D - -o /dev/null -w 'TIME_TOTAL=%{time_total} TTFB=%{time_starttransfer} SIZE=%{size_download}\n' 2>&1)
st=$(echo "$out" | grep -m1 '^HTTP' | awk '{print $2}')
cc=$(echo "$out" | grep -i '^cache-control:' | cut -d' ' -f2- | tr -d '\r')
xc=$(echo "$out" | grep -i '^x-vercel-cache:' | cut -d' ' -f2 | tr -d '\r')
age=$(echo "$out" | grep -i '^age:' | cut -d' ' -f2 | tr -d '\r')
id=$(echo "$out" | grep -i '^x-vercel-id:' | cut -d' ' -f2 | tr -d '\r')
t=$(echo "$out" | grep TIME_TOTAL)
echo "$(date '+%H:%M:%S') $1 status=$st cache=$xc age=${age:-} cc=\"$cc\" $t id=$id"
