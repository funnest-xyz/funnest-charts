#!/usr/bin/env bash
# Publish every package to npm in dependency order.
#   bash scripts/release.sh            # npm asks for the 2FA code / opens the browser
#   bash scripts/release.sh 123456     # pass the 6-digit 2FA code (valid ~30s)
# `pnpm pack` first so workspace:* becomes the real version, then `npm publish` the tarball.
set -euo pipefail
cd "$(dirname "$0")/.."
OTP="${1:-}"
OUT=.release
rm -rf "$OUT" && mkdir -p "$OUT"
pnpm build
for pkg in viz core ui react cli mcp; do
  (cd "packages/$pkg" && pnpm pack --pack-destination "../../$OUT" >/dev/null)
done
for pkg in viz core ui react cli mcp; do
  name=$(node -p "require('./packages/$pkg/package.json').name")
  version=$(node -p "require('./packages/$pkg/package.json').version")
  if npm view "$name@$version" version >/dev/null 2>&1; then
    echo "skip $name@$version (already published)"
    continue
  fi
  file="$OUT/$(echo "$name" | sed 's/@//; s#/#-#')-$version.tgz"
  echo "publish $name@$version"
  npm publish "$file" --access public ${OTP:+--otp="$OTP"}
done
