# NextFlix v1.0.0

NextFlix v1.0.0 brings the full IPTV experience together with a refreshed, themeable interface for LG webOS TVs.

## Highlights

- Choose Electric Violet, Emerald Night, Arctic Cyan, or Signal Red. The dark charcoal app surfaces remain consistent across themes; Electric Violet is the default.
- Refresh the NextFlix wordmark and sidebar with matching custom line icons.
- Keep Search inside Movies, Series, and Live TV instead of opening a separate Search destination.
- Start from cached IPTV catalogs while provider refreshes run in the background.
- Cache TMDB title details and selected Home playlists locally to reduce repeat requests.
- Show available channel or title artwork faintly behind playback errors.
- Package the launcher icon with the Electric Violet mark on the shared dark background.

The LG webOS launcher icon is packaged with the app and does not change when an in-app theme is selected. Violet is the app's default theme and packaged icon accent.

## Installation

Update NextFlix through the configured Homebrew repository using the same app ID. Keep the existing installation to preserve saved credentials and local profile data.

The release IPK is built without local test-provider credentials. IPTV playback, provider-dependent metadata, external subtitle availability, and some stream formats still depend on the user's provider and the TV decoder. Follow `RELEASE-CHECKLIST.md` to verify on the target television.
