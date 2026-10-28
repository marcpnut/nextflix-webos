# NextFlix v1.0.18 native input passthrough

- Remove keyboard visibility and DOM focus checks from the webOS input key path.
- While a real field is in edit mode, pass all keys through to webOS unchanged.
- Handle only the dedicated remote Back action to end input editing and return to the field proxy.

Build and package verification passed. Confirm C9 keyboard operation on the TV.
