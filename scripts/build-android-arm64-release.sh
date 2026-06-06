#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"

if [[ ! -f "$APP_GRADLE" ]]; then
  echo "android/app/build.gradle not found. Generate native Android project first."
  exit 1
fi

if ! grep -q "abiFilters 'arm64-v8a'" "$APP_GRADLE"; then
  perl -0pi -e "s/versionName \"([^\"]+)\"\\n/versionName \"\$1\"\\n        ndk {\\n            abiFilters 'arm64-v8a'\\n        }\\n/" "$APP_GRADLE"
fi

cd "$ANDROID_DIR"
./gradlew :app:clean :app:assembleRelease -PreactNativeArchitectures=arm64-v8a

echo "arm64-v8a release APK:"
ls -lh "$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
