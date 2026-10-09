# Generic Android WebView File Selection

`react-native-webview+13.12.5.patch` changes only Android's generic, non-capture
file input (no `accept` filter). It launches `ACTION_OPEN_DOCUMENT` directly
instead of the media-oriented OEM `ACTION_GET_CONTENT` chooser. The RMX5062
chooser otherwise offered only camera/video/photos despite document providers
being installed. Removing the Web input's mixed `accept` list alone did not fix
the physical-device reproduction.

Image/video-filtered inputs and explicit camera capture keep their original
behavior. Existing result callbacks and multiple-selection behavior are retained.
No broad storage permission or persistent URI permission is added. Uploads still
use the authenticated shared Web signing/commit flow and existing size limits.

The patch is applied by `npm` postinstall with `--error-on-fail`. When upgrading
WebView, review and regenerate this source-only patch; do not include native build
outputs. Validate document selection/upload, picker cancellation, camera capture
entry, and preserved chat history on a real Android device.

Platform reference: [Android Storage Access Framework](https://developer.android.com/training/data-storage/shared/documents-files).
The Android-only patch does not certify iOS attachment behavior.
