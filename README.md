# NextFlix — Phase 1

Minimal Xtream Codes live TV player for LG webOS TV 6.5.3 / Chromium 79.

## Phase 1 scope

- Enter an Xtream server URL, username, and password, with a Show/Hide control to reveal the password.
- Save the provider login before the connection attempt when remembering is enabled, so a failed request does not discard the entries.
- Show connection progress in both the form and top bar while requests are pending.
- Reconnect automatically at launch when a login is saved.
- Validate the account and load live categories/channels.
- Play a channel with direct HTML5 video.
- Switch channel with LG channel up/down keys or on-screen buttons.
- Close playback with Back and clear the session with Disconnect.
- Select `.ts` or `.m3u8` live URL format.

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

The `homebrew/` directory contains the Homebrew Channel catalog and app manifest for the public GitHub repository `marcpnut/nextflix-webos`. The manifest pins the Phase 1 IPK by SHA-256. The IPK is distributed as a GitHub Release asset (not committed to the source tree). Add this catalog URL in Homebrew Channel Settings → Repositories:

```text
https://raw.githubusercontent.com/marcpnut/nextflix-webos/main/homebrew/repo.json
```

The GitHub repository must be public for the TV's Homebrew Channel to download the catalog, manifest, and release asset without an account token. No provider credentials are included in the app or release.

## Current limitations

- Provider CORS rules can block `player_api.php` requests in the TV app.
- Codec and stream compatibility vary by provider and TV. No stream has been tested on the target TV yet.
- Remembered credentials use unencrypted app local storage on the TV. The Show/Hide control changes password visibility in the login form.
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
