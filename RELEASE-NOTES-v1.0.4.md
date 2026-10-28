# NextFlix v1.0.4

## Changes

- Build the same NextFlix app for the Chromium 53 web engine used by LG webOS 4.x TVs, while keeping newer LG webOS support.
- Add CSS fallbacks for older engines without CSS Grid and newer shorthand/color syntax.
- Add compatibility handling for older JavaScript APIs used by requests and metadata.
- Show a centered “Loading your streams” dialog when a screen change is still waiting for data after two seconds.
- Expand the Homebrew catalog description and add app/sidebar icon previews to the repository README.

## TV testing

- Update through Homebrew and confirm the saved login and app data remain available.
- Confirm the app is styled and navigable on the OLED65C9PLA (webOS 4.10) and LG Nano (webOS 6.5).
- Verify Xtream authentication, Live TV, Movies, Series, playback, and subtitle navigation on both TVs.
