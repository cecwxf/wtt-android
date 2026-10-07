#!/usr/bin/env bash

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -x /usr/libexec/java_home ]]; then
    JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || true)"
  fi
  if [[ -z "${JAVA_HOME:-}" ]]; then
    for candidate in /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home /usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home; do
      if [[ -x "$candidate/bin/java" ]]; then
        JAVA_HOME="$candidate"
        break
      fi
    done
  fi
  [[ -z "${JAVA_HOME:-}" ]] || export JAVA_HOME
fi

export NODE_ENV="${NODE_ENV:-production}"
WTT_ANDROID_BUILD_WORKERS="${WTT_ANDROID_BUILD_WORKERS:-2}"
WTT_ANDROID_GRADLE_HEAP_MB="${WTT_ANDROID_GRADLE_HEAP_MB:-6144}"
if [[ ! "$WTT_ANDROID_BUILD_WORKERS" =~ ^[1-9][0-9]*$ || ! "$WTT_ANDROID_GRADLE_HEAP_MB" =~ ^[1-9][0-9]*$ ]]; then
  echo 'Android build workers and heap size must be positive integers.' >&2
  exit 1
fi
WTT_ANDROID_GRADLE_ARGS=(
  "--max-workers=$WTT_ANDROID_BUILD_WORKERS"
  "-Dorg.gradle.jvmargs=-Xmx${WTT_ANDROID_GRADLE_HEAP_MB}m -XX:MaxMetaspaceSize=1024m"
  --console=plain
)
