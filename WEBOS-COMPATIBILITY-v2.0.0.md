# NextFlix v2.0.0 webOS compatibility notes

| TV | Reported platform | CPU report | Package target |
|---|---|---|---|
| LG OLED65C9PLA | webOS 4.10.0, firmware 05.50.00 | `uname -m` says aarch64; `getconf LONG_BIT` says 32 | Universal web app/IPK; Chromium 53 classic-script build |
| LG 55NANO886PB | Pear webOS, SDK 6.5.3, firmware 03.53.45 | ARMv7, 32-bit | Same universal web app/IPK |

## Storage and scheduling

The application uses IndexedDB object stores with a versioned upgrade from the existing v1 catalog snapshot. IndexedDB transactions provide atomic updates on ordinary webOS app origins. Catalog data remains scoped to the same `com.nextflix.iptv` application, allowing in-place app updates to retain data. The C9 and Nano do not require different IPK architecture builds because the package consists of web content and the same webOS JavaScript network service.

SQLite was not adopted: a regular signed web application has no generally available SQLite API. Adding a native privileged service or system modifications would be a larger and riskier change.

The app can schedule refreshes while its foreground app runtime is alive, and refresh when resumed or a network event returns. It cannot guarantee refresh at TV boot or while terminated. No boot hook, privileged system service, or protected partition modification is included.

Credentials persist in NextFlix's app-scoped IndexedDB settings store. webOS does not expose a documented credential-vault API to this ordinary app. App-origin isolation and omission from logs reduce exposure, but storage is not encrypted at rest. Encrypted user-password backups remain separately available.

## HTTP 511 investigation

The previously collected C9 response showed `HTTP/1.1 511 Network Authentication Required`, `Server: nginx`, and JSON content type. A no-credential `curl` request to the provider base also returned 511; HTTPS refused the connection. Those observations show the response is generated at the HTTP server/network path, rather than by the app's JSON parser, but do not identify whether the provider's nginx or an upstream intermediary is responsible.

The C9 app-owned service previously omitted `User-Agent`, while the TV browser request includes its WebAppManager User-Agent. v2.0.0 forwards that browser User-Agent and continues to omit `Origin`, matching normal browser identity while keeping the provider request in the app-owned service. Redirect count, final response origin, Server, Via, and content type are exposed in diagnostics; authenticated URLs and credentials are not. The service still refuses cross-origin redirects and uses standard TLS verification. A real authenticated C9 request is required to prove whether the missing User-Agent caused the 511.

## Verification status

Automated local checks cover database schema migration, independent dataset retention, failed/empty sync behavior, sync status, series episode cache, app settings store, saved provider persistence, backup encryption, and network service request headers/chunking. Physical C9 and Nano install, playback, input, subtitle, and reboot tests remain for the owner.
