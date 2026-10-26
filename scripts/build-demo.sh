#!/usr/bin/env bash
# Build Beis as a static, hash-routed clickable demo on its sample data.
#
#   bash scripts/build-demo.sh [out-dir]      (default: demo-build/)
#
# Copies the working tree (committed and uncommitted files) to a temp dir,
# drops the server code and the admin page (which needs Firebase), switches to
# adapter-static with the hash router, and writes <out-dir>/beis-demo.html: one
# file, scripts, styles and icon inside, that opens from disk or any web server.
# Without Firebase settings the app runs on the sample data in
# src/lib/stores/mock-data.ts, in memory: nothing is sent anywhere, and a
# reload starts it over.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mkdir -p "${1:-$ROOT/demo-build}" && cd "${1:-$ROOT/demo-build}" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
git ls-files -z --cached --others --exclude-standard -- src static package.json tsconfig.json vite.config.ts \
  | xargs -0 tar -cf - | tar -xf - -C "$WORK"
ln -s "$ROOT/node_modules" "$WORK/node_modules"

cd "$WORK"
rm -rf src/routes/api src/routes/admin src/hooks.server.ts src/lib/server
# The hash router renders on the client only; it takes no ssr option.
sed -i '/^export const ssr = false;$/d' src/routes/+layout.ts
# No Firebase in the demo. The app imports it only when Firebase is configured,
# but a one-file build runs every module at start, so leave nothing to start.
cat > src/lib/firebase.ts <<'STUB'
// The demo has no Firebase: without its settings the app runs on sample data
// and never uses these.
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
export const firebaseApp = undefined as unknown as FirebaseApp;
export const auth = undefined as unknown as Auth;
export const db = undefined as unknown as Firestore;
STUB

cat > svelte.config.js <<'CFG'
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'beis-demo.html' }),
    router: { type: 'hash' },
    appDir: 'app',
    paths: { relative: true },
    // Scripts and styles inside the page: one file that opens from anywhere.
    output: { bundleStrategy: 'inline' },
    alias: {
      $lib: './src/lib',
      $components: './src/lib/components',
      $stores: './src/lib/stores',
      $types: './src/lib/types'
    }
  }
};
CFG

# No Firebase settings: the app uses its sample data.
env -u VITE_FIREBASE_API_KEY npx svelte-kit sync
env -u VITE_FIREBASE_API_KEY VITE_HASH_ROUTER=1 npx vite build --logLevel warn

rm -rf "$OUT/app"
# Scripts and styles are inside the page, so the page is the whole demo. A
# small flag says it is a demo.
FLAG='<div role="note" style="position:fixed;bottom:12px;left:12px;z-index:50;pointer-events:none;padding:3px 10px;border-radius:999px;background:rgba(40,32,24,.82);color:#f4ead8;font:12px/1.6 system-ui,sans-serif">הדגמה · נתונים לדוגמה · שום דבר לא נשמר</div>'
ICON="data:image/svg+xml;base64,$(base64 -w0 static/favicon.svg)"
sed -e 's#<title>[^<]*</title>#<title>Beis · הדגמה</title>#' \
    -e "s#href=\"[./]*favicon.svg\"#href=\"${ICON}\"#" \
    -e 's#<meta name="description" content="[^"]*"#<meta name="description" content="Beis: clickable demo on sample data. Chaburos, chibburim, peer review, members, governance and treasury; nothing is saved."#' \
    -e "s|<body\([^>]*\)>|<body\1>${FLAG}|" \
    build/beis-demo.html > "$OUT/beis-demo.html"

echo "Demo written to $OUT/beis-demo.html ($(du -k "$OUT/beis-demo.html" | cut -f1) kB, one file)"
