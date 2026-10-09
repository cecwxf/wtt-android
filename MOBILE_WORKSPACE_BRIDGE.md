# Workspace Mobile Bridge

Source version: 1.2.24, Android versionCode 36, iOS buildNumber 30.
This is preparation for the Workspace-first client, not a published native release.
The installed apps and default `/mobile/feed` entry are not switched in this batch.

## Routes

- `/workspaces` and `/workspaces/hosts` reuse the existing native WebView screen.
- `wtt://workspaces?workspace=<id>&session=<id>&topic=<id>&agentId=<id>` maps to `/mobile/workspaces`.
- The exact HTTPS application origin and two exact new page paths are allowed by the native session, files and notification bridges. Media, arbitrary descendants and preview pages are not allowed.
- Login resume preserves only Workspace, session, Topic, Agent and source parameters. Credentials and unexpected fields are dropped.
- Session reset retains the validated route. Web waits for the existing native cookie exchange before redirecting an unauthenticated user.

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
- These checks do not prove APK/iOS native compilation, installation, real system file sharing,
  physical-device performance or same-account real model round trips. Those gates remain pending.
