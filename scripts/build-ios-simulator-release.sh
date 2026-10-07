#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
export NODE_ENV=production

if ! xcodebuild -version >/dev/null 2>&1; then
  echo 'Full Xcode and an iOS Simulator runtime are required. Command Line Tools alone cannot build iOS.' >&2
  exit 1
fi
if ! command -v pod >/dev/null 2>&1; then
  echo 'CocoaPods is required to install the native iOS dependencies.' >&2
  exit 1
fi

# Do not use --clean: Android keeps its existing native customizations and signing.
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
OUTPUT_DIR="$ROOT_DIR/build/ios-simulator"
xcodebuild -workspace "$ROOT_DIR/ios/WTT.xcworkspace" -scheme WTT \
  -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$OUTPUT_DIR" CODE_SIGNING_ALLOWED=NO build

echo "Simulator Release app: $OUTPUT_DIR/Build/Products/Release-iphonesimulator/WTT.app"
