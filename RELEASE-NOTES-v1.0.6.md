# NextFlix v1.0.6 C9 test build

- On webOS Chromium 53, use the browser's default fetch behavior for Xtream requests, matching the simple GET flow seen in the technical reference.
- Keep the existing request timeout behavior without passing the legacy engine an AbortSignal or custom cache and Accept options.
- Retain redacted HTTP 511 diagnostics if the login still fails.
- Preserve the single package ID for the C9 and newer LG webOS TVs.

Test this build on the C9 before treating it as a release fix.
