# NextFlix v1.0.17 webOS input activation fix

- Focus the native URL/text input synchronously during the remote OK action so webOS can open its system keyboard.
- Allow webOS to activate the focused input proxy through its native click path.
- Keep native keyboard key handling untouched while the keyboard is active.

Build and package verification passed. Physical C9 keyboard confirmation is still required.
