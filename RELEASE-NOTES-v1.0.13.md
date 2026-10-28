# NextFlix v1.0.13 C9 login keyboard fix

- Use the same native search input type already working in the catalog search for the server URL, username, and password fields.
- Remove differing URL/text input-mode hints that could invoke different keyboard behavior on older webOS.
- Make remote caret handling resilient when the TV input method does not expose selection APIs.

Build and package verification passed. Verify remote arrow and Backspace behavior on the LG C9.
