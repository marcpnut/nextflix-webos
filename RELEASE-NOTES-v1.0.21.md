# NextFlix v1.0.21 — Login persistence and native inputs

- Save Xtream login fields on the TV while entering them and before connecting.
- Restore the durable IndexedDB login first on startup, then fall back to local storage.
- Verify saved login data by reading it back from storage.
- Remove custom text input proxies and key interception so webOS owns keyboard arrows and Backspace.
- Keep API key persistence in local storage with IndexedDB fallback.

