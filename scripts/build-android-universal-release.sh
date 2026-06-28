#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

if [[ ! -f "$ANDROID_DIR/app/build.gradle" ]]; then
  echo "android/app/build.gradle not found. Generate native Android project first."
  exit 1
fi

node "$ROOT_DIR/scripts/sync-android-version.mjs"
node "$ROOT_DIR/scripts/sync-android-assets.mjs"

cd "$ANDROID_DIR"
./gradlew :app:clean :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64

echo "universal release APK:"
ls -lh "$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
