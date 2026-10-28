# NextFlix v1.0.11 remote text input fix

- Make server URL input a text field with URL keyboard hint to keep caret editing supported on older webOS WebKit.
- Defer input focus after entering edit mode so the C9 native text editor can attach reliably.
- Track focus on the actual editable input to keep arrow and backspace handling in text-edit mode.

Build and package verification passed. Test server URL, username, and password editing with the C9 remote keyboard.
