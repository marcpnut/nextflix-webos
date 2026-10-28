# NextFlix v0.6.6

- Replaced OMDb movie and series metadata with TMDB search and detail lookups.
- Added TMDB API key or read access token entry in Settings; credentials are stored locally and are not embedded in the package.
- Added TMDB branding and required attribution in Settings.
- OpenSubtitles integration remains available with its own user-provided API key.

A TMDB key is required for metadata lookups. Playback and provider catalog loading do not depend on it.
