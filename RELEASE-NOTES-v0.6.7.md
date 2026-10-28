# NextFlix v0.6.7

## Highlights

- Removed QR and phone-pairing setup. Configure IPTV and API keys directly on the TV.
- Improved startup and catalog refresh: saved catalogs open immediately, movie/series requests run in parallel, and refreshes write one large cache snapshot instead of several.
- Persisted TMDB title details and Home playlist results locally, with bounded cache size and 12-hour playlist refreshes.
- Added faint title/channel artwork behind playback errors instead of leaving a plain black screen.
- Added Featured Movies and Featured Series TMDB rows and Home playlist choices in Settings.
- Replaced the framed app icon with a full-bleed NF monogram on a single-color background for TVs that apply different icon masks.
- Added webOS Chromium 79 flex-spacing compatibility so buttons remain separated on the TV.

## Notes

- Featured and other TMDB rows show titles matched to the IPTV catalog, so each item remains playable through the configured provider.
- TMDB API access is optional. Existing Recently Added Movies and Popular Series provider rows remain available without a TMDB key.
- IPTV catalog, TMDB title details, and playlist cache cleanup are available through Settings and preserve provider login, profiles, favorites, and watch history.
