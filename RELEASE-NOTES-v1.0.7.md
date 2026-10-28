# NextFlix v1.0.7 C9 test build

- On webOS Chromium 53, Xtream requests use the browser's default fetch behavior, matching the simple GET flow used by the technical reference.
- Preserve app-level timeout handling without passing a legacy AbortSignal or custom cache/Accept settings.
- In text-edit mode, Left/Right moves the caret and Backspace/Delete edits around the caret; remote Back still exits edit mode.
- Keep redacted HTTP 511 diagnostics for troubleshooting. Credentials and complete authenticated URLs are not logged.
- Update the displayed app version to 1.0.7.

Build and package verification passed. Test text editing and Xtream login on the C9 before treating this as a release fix.
