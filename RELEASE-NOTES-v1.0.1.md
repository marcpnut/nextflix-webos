# NextFlix v1.0.1

This update improves catalog readability and remote behavior on LG webOS TVs.

## Changes

- Size the Category control to the widest provider category across Live TV, Movies, and Series, and save that width per provider so it stays steady while filtering and changing screens.
- Close an open dropdown when focus leaves it or the user clicks elsewhere, without changing its selected value.
- Hide leading language markers such as `NL |` and `|NL|` in category, channel, and title labels while retaining the original provider data for filtering and playback.
- Keep the live preview-to-full-screen transition playing by starting the channel in the full-screen player instead of moving an active video element between containers.
- Keep the subtitle menu open until the user selects a track, presses Back, or clicks outside it.
- Route left-edge focus to the nearest sidebar destination and reserve Switch Profile for Down from the Settings sidebar item.

## TV testing

Verify the update on the LG Nano: install over the existing app, confirm saved credentials remain, check category control width while changing language and screens, and test live preview/full-screen playback, subtitle-menu focus, and left/right/down navigation. Physical TV testing remains necessary because webOS video-element and remote-focus behavior differ from a desktop browser.
