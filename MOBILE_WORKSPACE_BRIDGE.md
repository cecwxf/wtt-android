# Workspace Mobile Bridge

Source version: 1.2.24, Android versionCode 36, iOS buildNumber 30.
This is preparation for the Workspace-first client, not a published native release.
The source default WebView entry is now `/mobile/workspaces`; installed apps are not
switched until the final native build and real-device acceptance.

## Routes

- `/workspaces` and `/workspaces/hosts` reuse the existing native WebView screen.
- `wtt://workspaces?workspace=<id>&session=<id>&topic=<id>&agentId=<id>` maps to `/mobile/workspaces`.
- The exact HTTPS application origin and two exact new page paths are allowed by the native session, files and notification bridges. Media, arbitrary descendants and preview pages are not allowed.
- Login resume preserves only Workspace, session, Topic, Agent and source parameters. Credentials and unexpected fields are dropped.
- Session reset retains the validated route. Web waits for the existing native cookie exchange before redirecting an unauthenticated user.
- Notification taps open the Workspace portal with the existing Topic/Agent identifiers.
  The owned project directory is loaded on demand to find a matching session beyond
  the first page. Legacy Topics return to the existing mobile Feed after lookup.
  A 404 feature gate retains legacy access; authentication/network failures stay visible.
- A mismatched project/session/Topic link cannot mount chat or project tools; the user
  can open the canonical owned session. The underlying Topic protocol is unchanged.

## Downloads

`WTT_NATIVE_FILES` v2 accepts exactly one target:

```ts
{ workspaceId, path, filename, requestId }
// or the existing Agent target:
{ agentId, path, filename, requestId }
```

Workspace downloads use `/workspaces/:id/workspace/stat` and `/content`.
They never fall back to an Agent's default working directory.
The existing owner-authenticated API validates project and root permissions.
No owner credential enters the injected script or request message.
The native layer retains a 100 MiB limit, one active transfer, progress, cancellation,
account/document invalidation, exact completed size and user-initiated sharing.
Web accepts both v1 and v2 for legacy Agent files; project files require v2.

## Verification

- TypeScript and Android/iOS Hermes Bundle export pass.
- Focused bridge tests execute the injected script through request/progress/completion,
  and reject mixed targets, unsafe paths, forged origins and stale documents.
- Shared Web browser/Electron fixtures cover project file download selection and auth handoff.
- Single Codex creation/send/history/files, paginated Topic restoration, mismatched links,
  legacy Topic compatibility and native final-reply notification delivery are verified.
  Progress events do not generate notifications. This tests the existing bridge,
  not actual OS notification permission/delivery or background push.
- These checks do not prove APK/iOS native compilation, installation, real system file sharing,
  physical-device performance or same-account real model round trips. Those gates remain pending.

## Native Artifacts (2026-10-09)

- App source `e116e5027d1f336a8bb8c0cb9dbaf349d22e4a44`: universal Android
  Release APK built successfully, version 1.2.24/36, 448073267 bytes,
  SHA-256 `7704a1183d242d8520c77a1323f49983ef08b710b91a0b522e5b2cff1f23ecc9`.
  It uses the existing internal debug certificate, not a store release signature.
  All four ABIs contain the core React Native/Hermes/JNI/C++ startup libraries.
- The APK was installed on a new isolated API 35 arm64 Pixel 7 AVD. Cold launch
  completed in 1715 ms, remained alive after 15 seconds, and displayed the real
  privacy consent screen. Consent was not accepted; login, Workspace chat and
  native file sharing are not proven by this startup check. The AVD was stopped;
  the physical phone remains on 1.2.23 and public download links are unchanged.
- Local full Xcode is absent. macOS CI run `37867281726` completed the real Release
  build of the same app source at 01:17:47 UTC. The downloaded Simulator ZIP has
  SHA-256 `2f472a21226eda791b0c886509f00adbadf61f2cbf78d733aae37cb375908e12`;
  Info.plist identifies 1.2.24/30 and `com.waxbyte.wtt`. Its executable contains
  both arm64 and x86_64. Fresh Simulator startup run `37869131646` uses this exact
  artifact, without rebuilding, and passed on iPhone 15 / iOS 18.2. It remains
  alive after 15 seconds without Metro; the actual screenshot shows the privacy
  consent screen. Consent was not accepted. Login/chat and native file sharing
  remain unverified; startup does not stand in for those separate gates.
- Android CI no longer requests the removed SDK `tools` package. It explicitly
  installs platform-tools, uses Node 22.23.3, generates the current Expo Router
  declarations, and prepares native version/assets/speech models. The release job
  uses the same universal build script as the local APK. ImageMagick is installed
  explicitly on Linux rather than assuming the macOS `sips` tool is available.
  Doc-only changes do not rebuild APKs. These workflow changes do not change the
  app version/source or publish a new public download.
