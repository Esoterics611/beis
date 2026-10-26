#!/usr/bin/env bash
# Browser test of the static demo. Builds it, then drives it with Playwright
# (require('playwright') must resolve) twice: served by a web server, and
# opened straight from disk. Screenshots go to $SHOTS if set.
set -euo pipefail
cd "$(dirname "$0")/../.."
bash scripts/build-demo.sh > /dev/null
python3 -m http.server 4174 --bind 127.0.0.1 --directory demo-build > /dev/null 2>&1 &
server=$!
trap 'kill $server' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:4174/beis-demo.html && break; sleep 1; done
echo "── served"
node scripts/e2e/demo.mjs
echo "── from disk"
SHOTS= DEMO_URL="file://$PWD/demo-build/beis-demo.html" node scripts/e2e/demo.mjs
