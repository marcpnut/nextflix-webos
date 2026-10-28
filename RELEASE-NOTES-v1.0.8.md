# NextFlix v1.0.8 C9 networking test build

- Route Xtream requests on webOS Chromium 53 through a bundled app-owned JavaScript service. This avoids the packaged app's browser Origin context that the provider rejected during testing.
- Keep direct browser fetch for PC and newer webOS browser engines.
- Transfer large service responses in bounded chunks and restrict service calls to the NextFlix app ID.
- Keep HTTP/HTTPS certificate verification enabled; credentials and authenticated URLs are not logged.

The provider accepted the same login and C9 User-Agent from PowerShell when no Origin header was sent, and returned 404 for the packaged app Origin. This build tests an app-owned service request without that browser header. TV login validation is still required before publishing.
