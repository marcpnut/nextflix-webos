# NextFlix v1.0.16 native input key handling

- Stop capturing or preventing remote and keyboard keys while the webOS virtual keyboard is active.
- Track LG `keyboardStateChange` so keys remain with the system keyboard even if DOM focus reporting changes.
- Return focus to the input proxy after the keyboard closes, with a delay for voice-entry transitions.
- Preserve the URL-specific keyboard and ordinary text inputs.

Build and package verification passed. Confirm normal C9 on-screen keyboard editing.
