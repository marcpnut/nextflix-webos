# NextFlix — Phase 1

Minimal Xtream Codes live TV player for LG webOS TV 6.5.3 / Chromium 79.

## Phase 1 scope

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

When “Remember this login on this TV” is enabled, credentials are stored in the app's local storage without encryption so the app can reconnect on launch. They are not sent to NextFlix or logged; provider requests and stream URLs necessarily carry credentials to your IPTV provider. Uncheck the option to remove the saved login. Do not use a provider you are not authorized to access.

## Build

Requirements: Node.js 20+ and pnpm (or npm). Install dependencies, then build:

```powershell
pnpm install
pnpm build
```

Vite emits the static app into `dist/`, targeting Chromium 79. The metadata and original icons in `public/` are copied into `dist/`. Run `pnpm package` to create the IPK in `packages/`; this uses LG's webOS TV CLI (`@webos-tools/cli`).

## Rooted LG TV installation

The target TV is a rooted LG 55NANO886PB running webOS 6.5.3 / Pear webOS. NextFlix was installed through Homebrew. Use the Homebrew custom repository below to check for updates; the app can also be removed from Homebrew Channel.

## Homebrew custom repository

The `homebrew/` directory contains the Homebrew Channel catalog, app manifest, and versioned IPK for the public GitHub repository `marcpnut/nextflix-webos`. The manifest pins the package by SHA-256. Add this catalog URL in Homebrew Channel Settings → Repositories:

```text
https://raw.githubusercontent.com/marcpnut/nextflix-webos/main/homebrew/repo.json
```

The GitHub repository must be public for the TV's Homebrew Channel to download the catalog, manifest, and IPK without an account token. Build public packages without provider credentials. Never publish an IPK built with `.env.local` values.

For a local-only provider test build, copy `.env.local.example` to `.env.local` and fill in the test provider URL, username, and password. Vite embeds these values in the generated app, so **never publish or upload an IPK built with real credentials**. The `.env.local` file is ignored by Git. Remove it before building a public release.

## Current limitations

- Provider CORS rules can block `player_api.php` requests in the TV app.
- Codec and stream compatibility vary by provider and TV. No stream has been tested on the target TV yet.
- The channel cache uses IndexedDB and stores rebuildable provider catalogue data, not IPTV credentials. If IndexedDB is unavailable, the app still connects but cannot show the catalogue offline.
- Remembered credentials use unencrypted app local storage on the TV. The password is visible in this test build.
- The player does not use the undocumented `com.webos.media` track API. Audio/subtitle enumeration is not implemented in Phase 1.
- Catch-up, movies, series, profiles, EPG, and local pairing are outside Phase 1.

## Checklist

- [x] Phase 0: identify TV model, firmware, SDK, board, CPU architecture, and web engine.
- [x] Phase 1 implementation: initial source scaffold and player behavior.
- [x] Build an IPK with the webOS TV CLI.
- [x] Root SSH installation failure avoided; app installed through Homebrew.
- [x] Temporary server and staged IPK cleaned up.
- [x] Publish source and Homebrew catalog to the public GitHub repository.
- [x] Publish the versioned IPK release asset.
- [ ] Test provider connection, live playback, channel switching, and Back on the TV.
