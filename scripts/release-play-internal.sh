#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   EAS_PROJECT_ID=xxxx GOOGLE_PLAY_KEY_PATH=./google-play-key.json ./scripts/release-play-internal.sh
# Optional:
#   EAS_BUILD_PROFILE=production-global EAS_SUBMIT_PROFILE=production

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v eas >/dev/null 2>&1; then
  echo "❌ eas CLI not found. Install with: npm i -g eas-cli"
  exit 1
fi

if [[ -z "${EAS_PROJECT_ID:-}" ]]; then
  echo "❌ EAS_PROJECT_ID is required"
  exit 1
fi

export APP_VARIANT=global
export GOOGLE_PLAY_KEY_PATH="${GOOGLE_PLAY_KEY_PATH:-./google-play-key.json}"

echo "==> Preflight checks"
npm run release:check

BUILD_PROFILE="${EAS_BUILD_PROFILE:-production-global}"
SUBMIT_PROFILE="${EAS_SUBMIT_PROFILE:-production}"

echo "==> Building Android AAB with profile: $BUILD_PROFILE"
eas build --platform android --profile "$BUILD_PROFILE"

echo "==> Submitting to Google Play with profile: $SUBMIT_PROFILE"
eas submit --platform android --profile "$SUBMIT_PROFILE"

echo "✅ Google Play internal release flow completed"
