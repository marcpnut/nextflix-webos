# NextFlix v1.0.5 diagnostic build

- Show safe, redacted details when an Xtream login receives HTTP 511, including app version, browser User-Agent, request/response host, redirect status, selected response headers, and a short sanitized body excerpt.
- Do not log credentials, tokens, or the authenticated request URL.
- Retain the single app package for webOS 4.x and newer TVs.

This is a diagnostic build to identify the source of the C9 login response. Physical TV verification is still required.
