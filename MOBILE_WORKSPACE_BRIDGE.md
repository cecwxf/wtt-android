# Workspace Mobile Bridge

Source version: 1.2.25, Android versionCode 37, iOS buildNumber 31.
The source default WebView entry is `/mobile/workspaces`. The physical Android
test phone now runs the internal arm64 1.2.25 package; public links remain unchanged.

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
Android pushState emits a loading-start event without a loading-end event. Keep
bridges for these same-document transitions between exact trusted application
routes. Real document loads and untrusted routes still invalidate all bridges.
Downloads acknowledge admission immediately; missing bridge acknowledgment fails
after 10 seconds instead of leaving the page at zero percent indefinitely.
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
- The completed CI Release APK from run `37869248749` is now downloaded and
  verified, not just reported as a successful job. Artifact `11590542744` has
  ZIP SHA-256 `d826d5ee722ef85bcc034749ea76b8ce80a48581fce6aef8201066d47ec70c9b`.
  The APK is `build/android-ci-1.2.24/extracted/wtt-1.2.24-c65bfb3-release.apk`,
  449064707 bytes, SHA-256
  `8a9cd535ebf91439e3dc5aad04ab3da2266cc23114e8f9bd424642ff7e568ec2`.
  Package/version/ABIs/embedded bundle and v2 signature are verified. The
  certificate matches the existing local internal-test key, not a store release
  certificate. CI source `c65bfb3` differs from app source `e116e50` only in the
  build workflow and this document. No rebuild or public-link replacement was
  performed. Native startup/chat acceptance of this CI APK remains pending.

## Physical Android Acceptance (2026-10-09)

- The no-password RMX5062 was unlocked without changing its lock settings. The
  existing signed-in data was preserved while installing 1.2.24/36 and then the
  final internal 1.2.25/37 arm64 package.
- On 1.2.24, actual Workspace chat reached the local Mac Codex and returned
  `WTT_ANDROID_124_REAL_CHAT_PASS`. Execution completed. Force-stop/reopen and
  session switching retained this reply; the upgraded 1.2.25 also displayed it.
- Final installed 1.2.25 initiated a new actual message and received
  `WTT_ANDROID_125_REAL_CHAT_PASS`, with completed execution visible. This is
  a fresh model round trip, not just viewing 1.2.24's saved reply.
- Actual project file browsing and the self-contained HTML preview worked. Its
  counter changed from zero to one after a real tap.
- Reproduced zero-percent downloads on 1.2.24. On final 1.2.25, downloading the
  30-byte `acceptance-result.txt` completed and opened the Android system share
  sheet. No file was transmitted to an external application.
- Uploaded only synthetic `wtt-android-125-upload.txt` through the system document
  picker. The 35-byte file appeared in the project list, and `cmp` confirmed the
  authorized Mac project file exactly matches the synthetic input.
- Cancelling the actual 100 MiB project download displayed `Download cancelled`.
  Full large-file completion and checksum acceptance are recorded separately;
  cancellation alone does not prove complete transfer.
- The bounded complete-download attempt reached 18 percent after approximately
  five minutes. It was cancelled via UI, so full 100 MiB completion/performance
  is not accepted. Large-file revisions use metadata, not repeated whole-file
  hashing; the remaining transfer-performance diagnosis must not assume hashing.
- Final APK: `build/android-workspace-1.2.25/wtt-1.2.25-arm64-internal.apk`,
  332626550 bytes, SHA-256
  `a7da02bc97220c86ec33d2e1767a8d93f0de4b9b5bafa6425e9a3464f61c2060`.
  Incremental native Release build passed. This is an internal arm64 package,
  not the universal/store release or an iOS full-flow acceptance.

## Final iOS Simulator Artifact (2026-10-09)

- Downloaded the existing Release build from run `37885384250`, artifact
  `11596601685`, app source `561b8353de909f14fc24ced5b713e52870504004`.
  `build/ios-simulator-artifact-1.2.25/WTT-1.2.25-ios-simulator.zip` is
  34935866 bytes. Its SHA-256 matches the build manifest:
  `1720fae57414b6a3c7e199c0f0680c981e656d1be79e1acd715cdc67bffcd424`.
- Extracted Info.plist identifies WTT 1.2.25/31, `com.waxbyte.wtt`,
  iPhoneSimulator, minimum iOS 16.4. The executable contains arm64 and x86_64.
- Verification run `37889625214` completed successfully using that exact
  artifact, without rebuilding. Installed on iPhone 15 / iOS 18.2, cold launched
  the standalone Release app without Metro, and remained alive after 15 seconds.
  Downloaded `build/ios-startup-evidence-1.2.25/startup.json` and `startup.png`;
  the actual screenshot displays privacy/terms consent. Consent was not accepted.
- Local full Xcode remains absent. Neither this startup evidence nor the compiled
  artifact proves actual iOS authentication, Workspace chat, native file sharing
  or OS notification delivery. Those gates remain explicitly unverified.
