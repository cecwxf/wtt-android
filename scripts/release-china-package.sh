#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   EAS_PROJECT_ID=xxxx ./scripts/release-china-package.sh
# Optional:
#   EAS_BUILD_PROFILE=production-china

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

export APP_VARIANT=china

echo "==> Preflight checks"
npm run release:check

BUILD_PROFILE="${EAS_BUILD_PROFILE:-production-china}"

echo "==> Building Android package with profile: $BUILD_PROFILE"
eas build --platform android --profile "$BUILD_PROFILE"

echo "✅ China store package build submitted. Download artifact from EAS dashboard for manual store upload."
