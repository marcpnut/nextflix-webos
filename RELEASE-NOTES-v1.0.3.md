# NextFlix v1.0.3

## Changes

- Show a centered “Loading your streams” dialog when a screen transition is still waiting for data after two seconds.
- Keep the loading preview simulation limited to the local browser demo.
- Retain the existing provider login, catalog, and playback behavior.

## TV testing

- Update NextFlix through Homebrew and confirm the saved provider login remains available.
- Navigate between Home, Movies, Series, Live TV, and Settings. Confirm the loading dialog appears only when a transition takes longer than two seconds and closes when loading finishes.
- Test on the primary Nano TV and the older C9. Record any layout or playback compatibility problems.
