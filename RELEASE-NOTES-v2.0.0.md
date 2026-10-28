# NextFlix v2.0.0

## Changes since v1.0.23

- Bump app and service metadata to v2.0.0 while retaining `com.nextflix.iptv` for an in-place Homebrew update.
- Move remembered Xtream credentials to the TV app's persistent IndexedDB settings store. Existing localStorage logins remain readable for migration; a verified IndexedDB save removes the duplicate legacy copy.
- Upgrade the catalog database schema without deleting the v1 catalog snapshot. Catalogs and sync state are stored independently for Live TV, Movies, and Series; one catalog's refresh no longer overwrites another.
- Restore cached catalogs immediately, then refresh due data in the background. Default intervals are Live TV 6 hours, Movies 12 hours, Series 12 hours. Episodes are saved on demand.
- Keep the last known catalog when an endpoint fails or returns an empty list. Display cached data offline and show per-section sync timestamps/errors in Settings.
- Add Settings controls for manual refresh and intervals. Refresh retries on app launch/resume, network recovery, and while the app remains open.
- Forward the C9 WebAppManager browser User-Agent through the app-owned webOS network service. Continue omitting `Origin`, enforce same-origin redirects, and include redacted HTTP 511 response headers and redirect count in diagnostics.
- Mirror profiles, favorites, watch progress, category visibility, language preferences, theme, and home playlist selection into the catalog database while preserving the existing localStorage format.
- Add catalog database migration, retention, episodes, status records, and storage regression checks.

## Compatibility and limits

- One universal web app package targets Chromium 53/webOS 4.x and later webOS releases; this build does not need separate C9 and Nano binaries.
- Ordinary packaged webOS applications do not have a supported SQLite database API or a reliable closed-app/boot-start scheduler. IndexedDB is used as the transactional local database. Synchronization runs only while NextFlix is active, and resumes on launch, app resume, or network reconnection.
- webOS app storage is isolated to the app but is not an OS credential vault and is not encrypted at rest. Credentials are never written to diagnostics or logs and are sent only to the configured IPTV provider.
- The C9 HTTP 511 cause cannot be confirmed without retrying on the physical C9. Diagnostics previously showed an nginx 511; this release adds the browser User-Agent to the C9 service request to match its app browser. It does not bypass provider authentication or TLS checks.
- Playback, app upgrade data retention, and UI responsiveness still require the owner's physical TV testing.
