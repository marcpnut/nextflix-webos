# NextFlix — Version 2.0.0

Lightweight IPTV player for LG webOS. The single app package targets Chromium 53 for older webOS 4.x TVs and remains compatible with newer webOS releases.

On webOS Chromium 53, Xtream requests use a bundled app-owned JavaScript service so the browser's packaged-app Origin header does not affect provider login. It forwards the app browser User-Agent without sending an Origin header, allows only same-server redirects, uses ordinary HTTP/HTTPS, and never logs credentials or complete authenticated URLs. Catalogs are stored in persistent IndexedDB and displayed immediately; independent Live TV, Movies, and Series refreshes run in the background on app launch/resume and use configurable 6/12-hour defaults. Large provider responses are transferred in bounded chunks. The package keeps the same app ID for in-place updates.

## App artwork preview

| NextFlix app icon | Home | Movies | Series | Live TV | My List | Settings |
|---|---|---|---|---|---|---|
| ![NextFlix app icon](public/nextflix-icon-violet.png) | ![Home navigation icon](public/icons/home.png) | ![Movies navigation icon](public/icons/movies.png) | ![Series navigation icon](public/icons/series.png) | ![Live TV navigation icon](public/icons/live.png) | ![My List navigation icon](public/icons/my-list.png) | ![Settings navigation icon](public/icons/settings.png) |

## Current scope

- Enter an Xtream server URL, username, and password. The password is visible in this test build.
- Run the browser version locally with `pnpm dev` to test provider login and channel loading before packaging.
- Save the provider login explicitly with **Save login**, and save it again before connecting when remembering is enabled.
- Show connection progress in both the form and top bar while requests are pending.
- Reconnect automatically at launch when a login is saved.
- Show saved Live TV, Movies, and Series immediately and refresh stale datasets in the background.
- Show the running app version on the setup screen.
- Validate the account and load live categories/channels.
- Allow up to 60 seconds for login, 90 seconds for categories, and 180 seconds for the channel list.
- Play a channel with direct HTML5 video.
- Switch channel with LG channel up/down keys or on-screen buttons.
- Close playback with Back and clear the session with Disconnect.
- Prefer the live format advertised by the Xtream account (MPEG-TS when allowed, otherwise HLS when available); allow a manual format override.
- Use the provider's returned playback server when available, as well as its advertised output formats.
- Report common network, decode, and unsupported-format playback failures separately.
- Load Xtream VOD movies and series after Live TV becomes available.
- Cache movie and series catalogues alongside live channels.
- Search the selected catalogue and filter it by the provider's category names.
- Display provider posters, movie year/rating, and series episode lists when returned by the provider.
- Play movie and episode streams through the same HTML5 player.
- Load a single M3U playlist URL, parse `group-title` and `tvg-logo`, and play its channel URLs directly.
- Browse from a collapsible sidebar with Home, Movies, Series, Live TV, My List, and Settings. Search stays within each catalog screen.
- Choose Electric Violet, Emerald Night, Arctic Cyan, or Signal Red. All themes keep the same dark neutral backgrounds; Violet is the default.
- Show a featured title and poster rows on Home; open title details before playback.
- Show Featured Movies and Featured Series from TMDB alongside recently added and popular provider titles; configure additional TMDB rows in Settings. Home playlist and title metadata caches persist locally.
- Display a softly faded poster/backdrop when a stream fails, while keeping the playback error visible.
- Reuse cached IPTV catalogs immediately, refresh movie/series catalogs with bounded concurrent requests, and avoid repeated large cache writes during refresh.
- Use a full-bleed single-color app icon with a clean NextFlix NF monogram, without a frame that can be clipped by different TV icon masks.
- Save movies and series to a local My List.
- Hide and restore provider categories; hidden categories are excluded from browsing, Home, and search.
- Filter Live TV, Movies, Series, and Settings using the literal text before `|` or between the first two pipes (for example, `NL/PL | ...` or `|NL| ...`). Options are derived from category names; the filter is hidden on Home.
- Seek VOD with the focused progress slider or remote Left/Right; short presses skip 10 seconds and holding accelerates seeking. When another player control is focused, Left/Right moves focus between controls instead.
- Use the sidebar to move between Home, Movies, Series, and Live TV. The catalogue toolbar has a compact Language filter, Search, Category, and applicable actions on one row; it has no Browse selector.
- Save local VOD resume progress and show a Continue Watching row on Home. Movie details offer Resume and Start from beginning.
- Restore focus to the selected language filter after the results refresh; bound Home, catalogue, and My List card titles with a visible ellipsis.
- Keep the provider/decoder default audio selection (or an explicitly exposed `main` role); select preferred subtitles from HTML text tracks or the optional LG media-service adapter. Users can choose subtitles manually or turn them off.
- Offer a cancellable 10-second next-episode countdown when the current series episode ends and the next episode is available in the loaded series list.
- Use a full-screen player overlay with a top back arrow and white icon controls; VOD shows 10-second skip controls and Live TV shows previous/next channel controls.
- Navigate closed dropdowns with the D-pad; press OK to open one, use Up/Down within its options, and Left/Right to move focus away.
- Browse Movies and Series in filtered pages of 20 titles, with independent page positions and remote-friendly Previous/Next controls.
- Use dropdowns in explicit selection mode: OK opens, Up/Down highlights, OK commits, and Back cancels without changing the saved value.
- Navigate between language, content rows, and the sidebar with a single centralized D-pad handler; moving onto text inputs focuses a proxy until OK opens text editing.
- Set a preferred subtitle language from a supported language list; it persists per profile and applies when a matching track is exposed.
- Find Disconnect only in Settings; browsing and playback no longer expose a normal-view disconnect action.
- Create up to eight local viewer profiles, switch profiles from the sidebar, and keep favorites, subtitle preferences, and Continue Watching history separate by profile. Recommendations are calculated locally from each profile's watch history, favorites, provider categories, and series genres.
- Keep the Live TV page fixed while only its channel list scrolls. Selecting a channel tunes the preview; selecting that same channel again opens it full screen.
- Hide native scrollbars and show light edge arrows only where more content is available in that direction.
- Use locally stored playback progress only; no stream URLs or provider credentials are stored in watch history.
- Export and restore app settings in an AES-GCM encrypted backup using a password-derived key. Backups include saved provider settings, profiles, favorites, category visibility, and history; rebuildable catalog data is excluded.
- Inspect app/browser, playback probes, local settings size, and IndexedDB cache counts in Settings. Clear only rebuildable catalog caches without clearing profiles or viewing data.
- Retain catalog metadata, sync status, episode lists, and mirrored settings in a versioned IndexedDB database. Prune stale rebuildable catalog snapshots after 90 days.
- Optionally enrich VOD details through a user-provided TMDB API key and search external subtitles through a user-provided OpenSubtitles API consumer key.
- Check public GitHub Releases on demand. NextFlix never installs an update automatically.
- Navigate with directional remote keys and get focus return when closing title details.
- Require three Back presses on Home before showing the exit confirmation; Back closes the player or returns to Home from a subpage.

When “Remember this login on this TV” is enabled, credentials are stored in the TV app's IndexedDB settings database, scoped to NextFlix's application origin. This is persistent app storage, not an OS credential vault, and webOS does not encrypt it at rest. Credentials are never logged or sent to NextFlix; provider requests and stream URLs carry credentials only to the configured IPTV service. Uncheck the option to remove the saved login. Use only an authorized IPTV provider.

## Build

Requirements: Node.js 20+ and pnpm (or npm). Install dependencies, then build:

```powershell
pnpm install
pnpm build
```

Vite emits the static app into `dist/`, targeting Chromium 53, the web engine used by webOS 4.x; the same package also targets newer webOS TVs. The package build rewrites Vite's module entry to a self-contained classic script because webOS launches packaged app resources from a `file:` URL. The metadata and original icons in `public/` are copied into `dist/`. Run `pnpm package` to create a public IPK in `packages/`; the script overrides local test-provider variables and checks the output before calling LG's webOS TV CLI (`@webos-tools/cli`).

## Rooted LG TV installation

The target TV is a rooted LG 55NANO886PB running webOS 6.5.3 / Pear webOS. NextFlix was installed through Homebrew. Use the Homebrew custom repository below to check for updates; the app can also be removed from Homebrew Channel.

## Homebrew custom repository

The `homebrew/` directory contains the Homebrew Channel catalog, app manifest, and versioned IPK for the public GitHub repository `marcpnut/nextflix-webos`. The manifest pins the GitHub Release package by SHA-256. Add this catalog URL in Homebrew Channel Settings → Repositories:

```text
https://marcpnut.github.io/repo
```

The GitHub repository must be public for the TV's Homebrew Channel to download the catalog, manifest, and IPK without an account token. Build public packages with `pnpm package`, which strips the local test-provider variables and refuses packaging if their values remain in the output.

For a local-only provider test build, copy `.env.local.example` to `.env.local` and fill in the test provider URL, username, and password. Plain `pnpm build` embeds these values in `dist/`, so **never publish or upload its output**. The `.env.local` file is ignored by Git. Use `pnpm package` for the public release build.

## v2.0.0 platform constraints

- Normal packaged webOS apps have no supported SQLite service/API. NextFlix uses transactional, versioned IndexedDB stores compatible with the C9's Chromium 53-era app runtime and newer Nano webOS.
- webOS does not guarantee app execution at TV boot or while NextFlix is closed. Catalog refresh therefore runs on app launch/resume, network recovery, and periodically while the app stays open; no boot scripts or protected system partitions are changed.
- HTTP 511 on the C9 was observed from an nginx response. v2.0.0 adds browser User-Agent parity to the C9 network service and richer redacted diagnostics. The provider/network response still needs verification on the physical C9; the app does not bypass authentication or disable TLS checks.

## Current limitations

- Provider CORS rules can block `player_api.php` requests in the TV app.
- Codec and stream compatibility vary by provider and TV. The user has confirmed Live TV, Movies, and Series playback on the target TV. The Phase 3 interface still needs TV testing.
- If IndexedDB is unavailable, the app still connects but cannot provide offline catalog storage or persistent database synchronization.
- Remembered credentials use unencrypted app local storage on the TV. The password is visible in this test build.
- This project targets one IPTV provider at a time; multi-provider merging is intentionally out of scope.
- External subtitle search and WebVTT playback are implemented but still need verification on the LG TV; source failover and local pairing are not implemented.
- The TV Guide, XMLTV downloads, provider EPG requests, and catch-up controls have been removed in 0.6.2 to reduce background requests and app work.
- Encrypted backup export/import and download/file-picker behavior need testing on the physical TV. If Web Crypto or browser file handling is unavailable, the backup actions report the limitation instead of writing a plaintext backup. Normal packaged webOS apps cannot host a temporary inbound HTTP pairing server, so TV-phone local pairing and LAN-based file transfer are not implemented; manual setup and encrypted file backup remain the supported paths.
- The GitHub release check is user initiated and requires the TV browser to reach `api.github.com`; it only links to the release page and never installs or replaces the app.
- Catch-up URL construction follows the Xtream timeshift route pattern, but the provider must advertise archive support and accept the requested archive stream. Actual Replay and Start Over remain unverified.
- LG officially supports external WebVTT subtitles in ordinary web apps, but embedded subtitle discovery/selection can vary by stream and TV. The optional `com.webos.media` adapter is best-effort and must be verified on the target TV. Audio handling leaves the provider/decoder default alone unless a `main` track role is explicitly exposed. Subtitle selection and episode autoplay still need verification with a real multilingual stream.
- LG webOS opens its virtual keyboard when an editable input receives focus. NextFlix applies the same focusable proxy-button behavior to every editable input type, while keeping checkboxes, radio buttons, range sliders, and action inputs native. TV testing is needed to verify that Pear webOS consistently delivers the remote Back key while its virtual keyboard is open.
- An intermittent black screen after returning to NextFlix from Home was reported; it has not been reproduced or verified fixed yet.

## Checklist

- [x] Phase 0: identify TV model, firmware, SDK, board, CPU architecture, and web engine.
- [x] Phase 1 implementation: initial source scaffold and player behavior.
- [x] Build an IPK with the webOS TV CLI.
- [x] Root SSH installation failure avoided; app installed through Homebrew.
- [x] Temporary server and staged IPK cleaned up.
- [x] Publish source and Homebrew catalog to the public GitHub repository.
- [x] Publish the versioned IPK release asset.
- [x] User verified provider login, live-channel loading, and playback on the target TV.
- [x] User verified movie and series playback on the target TV.
- [ ] Test Phase 3 sidebar, detail/search/dropdown focus, filter spacing, poster sizing, My List, category and language filters, and three-press exit on the TV.
- [ ] Test Phase 4 player icon controls, VOD seeking, resume position, and progress cleanup on completion on the TV.
- [ ] Test language-filter focus restoration, card-title truncation, audio/subtitle selection, preferred-language behavior, and series autoplay on the TV.
- [ ] Test 20-item Movies/Series pagination, filtered page counts, dropdown confirm/cancel, input edit/Back behavior, and Disconnect location on the TV.
- [x] Phase 5 guide implementation was removed in 0.6.2 at the user's request; the app no longer fetches EPG/XMLTV data.
- [x] Phase 6 implementation: local viewer profiles, profile-scoped favorites/subtitle preferences/watch history, and local recommendations.
- [ ] Phase 6 TV validation: create and switch profiles, confirm favorites and resume history remain separate, and verify subtitle preference persistence.
- [x] Phase 7 implementation: password-encrypted settings backup/restore, rebuildable cache cleanup, local diagnostics, and an on-demand manual release check.
- [x] Phase 7 storage safeguard (v1): IndexedDB catalog cleanup; v2.0.0 extends the retention window to 90 days.
- [ ] Phase 7 TV validation: verify backup file export/import and passphrase handling, cache cleanup preserves profiles/history, diagnostics report gracefully, and the optional release check works on TV.
- [ ] Phase 7 feasibility item: local phone pairing/LAN transfer remains unavailable to ordinary packaged apps without a listener service; keep manual entry and encrypted backup as the safe alternatives.
- [x] Phase 8 local gate: rebuild and package 1.0.0 before release.
- [ ] Phase 8 TV gate: verify 1.0.0 player navigation, subtitle overlays, TV scroll arrows, focus visibility at all grid edges, metadata, and external subtitle behavior on the LG.
- [x] v2.0.0 local implementation: persistent catalog database, separate catalog sync state, retained cached catalogs after failed/empty refreshes, episode cache, manual/interval controls, provider credential IndexedDB verification, and redacted C9 network diagnostics.
- [ ] v2.0.0 TV validation: install over v1.0.23, confirm credentials/catalogs survive reboot, verify background refresh behavior and subtitle menu on C9 and Nano, and retest playback on both.

