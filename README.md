# NextFlix — Phase 6 profiles and playback fixes (0.5.0)

Minimal Xtream Codes live TV player for LG webOS TV 6.5.3 / Chromium 79.

## Current scope

- Enter an Xtream server URL, username, and password. The password is visible in this test build.
- Run the browser version locally with `pnpm dev` to test provider login and channel loading before packaging.
- Save the provider login explicitly with **Save login**, and save it again before connecting when remembering is enabled.
- Show connection progress in both the form and top bar while requests are pending.
- Reconnect automatically at launch when a login is saved.
- Show a cached live-channel catalogue immediately and refresh it in the background when it is at least 24 hours old.
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
- Load a single M3U playlist URL, parse `group-title`, `tvg-id`, and `tvg-logo`, and play its channel URLs directly.
- Browse from a collapsible sidebar with Home, Search, Movies, Series, Live TV, My List, and Settings.
- Show a featured title and poster rows on Home; open title details before playback.
- Save movies and series to a local My List.
- Hide and restore provider categories; hidden categories are excluded from browsing, Home, and search.
- Filter Live TV, Movies, Series, and Settings using the literal text before `|` or between the first two pipes (for example, `NL/PL | ...` or `|NL| ...`). Options are derived from category names; the filter is hidden on Home.
- Seek VOD with the focused progress slider or remote Left/Right; short presses skip 10 seconds and holding accelerates seeking. When another player control is focused, Left/Right moves focus between controls instead.
- In the catalogue toolbar, Search Left/Right moves directly to Browse/Category. Toolbar controls have increased spacing.
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
- Show a large Live TV preview above the channel list. Selecting a channel tunes the preview; selecting that same channel again opens it full screen. The TV Guide opens with the first channel in the active category/filter.
- Open the Live TV guide from Live TV or the player while reusing the current video element as a small preview. Moving guide focus never retunes the stream; select a program and choose Watch live to tune it.
- Keep the guide preview inside a compact box above the guide grid so it does not cover the timeline.
- Limit each TV Guide page to five channels and the visible timeline to four hours. The guide uses a 24-hour clock and loads per-channel Xtream guide data for the visible page in parallel.
- Parse provider or custom XMLTV data with confident exact-ID/name matching, manual per-channel mappings, a 12-hour IndexedDB cache, seven-day retention, a 16 MB input cap, and an 80,000-program cap.
- Fall back to Xtream `get_simple_data_table` guide requests when XMLTV is unavailable; provider listings are fetched in small channel batches as pages are visited.
- Show now/next details in Live TV and an hourly timeline covering the current time through the next four hours.
- Offer Replay or Start Over only when Xtream channel data reports archive support and a valid archive duration.
- Use locally stored playback progress only; no stream URLs or provider credentials are stored in watch history.
- Navigate with directional remote keys and get focus return when closing title details.
- Require three Back presses on Home before showing the exit confirmation; Back closes the player or returns to Home from a subpage.

When “Remember this login on this TV” is enabled, credentials are stored in the app's local storage without encryption so the app can reconnect on launch. They are not sent to NextFlix or logged; provider requests and stream URLs necessarily carry credentials to your IPTV provider. Uncheck the option to remove the saved login. Do not use a provider you are not authorized to access.

## Build

Requirements: Node.js 20+ and pnpm (or npm). Install dependencies, then build:

```powershell
pnpm install
pnpm build
```

Vite emits the static app into `dist/`, targeting Chromium 79. The package build rewrites Vite's module entry to a self-contained classic script because webOS launches packaged app resources from a `file:` URL. The metadata and original icons in `public/` are copied into `dist/`. Run `pnpm package` to create the IPK in `packages/`; this uses LG's webOS TV CLI (`@webos-tools/cli`).

## Rooted LG TV installation

The target TV is a rooted LG 55NANO886PB running webOS 6.5.3 / Pear webOS. NextFlix was installed through Homebrew. Use the Homebrew custom repository below to check for updates; the app can also be removed from Homebrew Channel.

## Homebrew custom repository

The `homebrew/` directory contains the Homebrew Channel catalog, app manifest, and versioned IPK for the public GitHub repository `marcpnut/nextflix-webos`. The manifest pins the GitHub Release package by SHA-256. Add this catalog URL in Homebrew Channel Settings → Repositories:

```text
https://raw.githubusercontent.com/marcpnut/nextflix-webos/main/homebrew/repo.json
```

The GitHub repository must be public for the TV's Homebrew Channel to download the catalog, manifest, and IPK without an account token. Build public packages without provider credentials. Never publish an IPK built with `.env.local` values.

For a local-only provider test build, copy `.env.local.example` to `.env.local` and fill in the test provider URL, username, and password. Vite embeds these values in the generated app, so **never publish or upload an IPK built with real credentials**. The `.env.local` file is ignored by Git. Remove it before building a public release.

## Current limitations

- Provider CORS rules can block `player_api.php` requests in the TV app.
- Codec and stream compatibility vary by provider and TV. The user has confirmed Live TV, Movies, and Series playback on the target TV. The Phase 3 interface still needs TV testing.
- The channel cache uses IndexedDB and stores rebuildable provider catalogue data, not IPTV credentials. If IndexedDB is unavailable, the app still connects but cannot show the catalogue offline.
- Remembered credentials use unencrypted app local storage on the TV. The password is visible in this test build.
- This project targets one IPTV provider at a time; multi-provider merging is intentionally out of scope.
- External subtitle loading, source failover, and local pairing are not implemented yet.
- The Phase 5 EPG guide and catch-up implementation is new and has not yet been verified against the user's IPTV provider or on the physical TV. XMLTV downloads require provider CORS support; compressed XMLTV files that are not transparently decompressed by the browser are unsupported. The provider API fallback fetches guide data per channel and is intentionally on demand.
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
- [x] Phase 5 implementation: EPG timeline, cached provider/XMLTV data, manual channel mappings, live preview, and archive-gated replay actions.
- [ ] Phase 5 TV validation: test guide preview, current/next data, XMLTV and mapping, channel switching, archive Replay/Start Over, and recovery from guide/network errors.
- [ ] Verify Live TV's large preview, same-channel fullscreen toggle, first filtered channel when opening TV Guide, five-channel/four-hour guide, 24-hour labels, and all editable input proxies on the LG TV.
- [x] Phase 6 implementation: local viewer profiles, profile-scoped favorites/subtitle preferences/watch history, and local recommendations.
- [ ] Phase 6 TV validation: create and switch profiles, confirm favorites and resume history remain separate, and verify subtitle preference persistence.
