#!/usr/bin/env bash
# Install Apple Silicon OrbStack (replaces Docker Desktop for lower RAM).
# Intel Homebrew under /usr/local installs the wrong arch — use this script instead.
set -euo pipefail

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "This helper is for Apple Silicon. Use https://orbstack.dev/download" >&2
  exit 1
fi

URL="${ORBSTACK_DMG_URL:-https://cdn-updates.orbstack.dev/arm64/OrbStack_v2.2.3_20963_arm64.dmg}"
CACHE_DIR="$(CDPATH="" cd "$(dirname "$0")/.." && pwd)/.cache"
mkdir -p "$CACHE_DIR"
DMG="$CACHE_DIR/OrbStack_arm64.dmg"

if [[ ! -f "$DMG" ]]; then
  echo ">> Downloading OrbStack arm64…"
  curl -fL \
    -A "Mozilla/5.0 (Macintosh; Apple Silicon) AppleWebKit/605.1.15" \
    -o "$DMG" \
    "$URL"
else
  echo ">> Using cached $DMG"
fi

echo ">> Installing to /Applications…"
osascript -e 'quit app "OrbStack"' 2>/dev/null || true
sleep 1
ATTACH_OUT="$(hdiutil attach -nobrowse -readonly "$DMG")"
ATTACH="$(echo "$ATTACH_OUT" | tail -1 | awk '{$1=$2=""; print substr($0,3)}' | sed 's/[[:space:]]*$//')"
rm -rf /Applications/OrbStack.app
cp -R "$ATTACH/OrbStack.app" /Applications/
hdiutil detach "$ATTACH" >/dev/null || hdiutil detach "$ATTACH" -force >/dev/null || true
file /Applications/OrbStack.app/Contents/MacOS/OrbStack | grep -q arm64 \
  || { echo "Installed binary is not arm64" >&2; exit 1; }

echo ">> Opening OrbStack — finish first-run setup, then quit Docker Desktop if you want."
open /Applications/OrbStack.app
echo "Done. Verify: docker info && docker compose version"
