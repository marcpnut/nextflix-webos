# NextFlix v1.0.2

This update makes subtitle selection more reliable with the LG webOS remote.

## Changes

- Open the subtitle menu with focus on its first option.
- Handle Up/Down through subtitle options explicitly from remote key events, with a visible highlight that does not depend only on browser focus styling.
- Close the menu when navigation leaves its option list or when focus moves elsewhere.
- Keep Back and outside-click dismissal available.

## TV testing

On the LG TV, open a movie or series with selectable subtitle tracks, press the Subtitles control, verify the first option is highlighted, move through options with Up/Down, and leave the menu with Left/Right or Back. Confirm the menu closes and track selection still works. Availability and actual subtitle rendering depend on what the stream exposes to webOS.
