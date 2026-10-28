# NextFlix v0.6.0 — Guide and device maintenance

- Live TV now keeps the preview and filters fixed while the channel list scrolls.
- TV Guide fills the screen with a larger preview above a continuously scrolling five-channel timeline. The timeline shows four hours with 24-hour time labels.
- Removed the Browse dropdown. Language, Search, Category, and TV Guide fit together on one toolbar row.
- Added password-encrypted backup and restore for saved provider settings, profiles, favorites, category visibility, EPG mappings, and watch history.
- Added local diagnostics, rebuildable cache cleanup and pruning, and an optional manual GitHub release check.
- Updated the public IPK build to strip local test-provider values before packaging.

The package upgrades the existing app ID. Use Homebrew **Update** rather than uninstalling, so the TV keeps its local data. Playback, backup file handling, subtitles, and archive replay still require verification on the LG TV. See `RELEASE-CHECKLIST.md` for the test steps.
