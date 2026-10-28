# NextFlix 0.6.1 TV release checklist

Use the Homebrew **Update** action over the installed NextFlix app. Keep the same app ID (`com.nextflix.iptv`) and do not uninstall the old version: uninstalling can remove locally saved credentials and profiles.

## Before updating

- Confirm the TV is the LG 55NANO886PB on webOS 6.5.3 / Pear webOS.
- Record the currently installed NextFlix version. If the current build offers encrypted backup export and the TV can save the file, make a backup first.
- Confirm the Homebrew manifest identifies version 0.6.1 and its package hash matches the release asset.

## Smoke test after updating

1. Launch NextFlix. Confirm it shows 0.6.1, retains the saved provider login, and opens cached channels quickly.
2. Open Live TV. Select a channel for preview, select it again for full screen, switch with Channel Up/Down, and exit with Back.
3. Confirm only the channel list scrolls. Open TV Guide; the preview should fill the upper area and five guide rows should scroll continuously below it. Check 24-hour time labels and that moving focus does not retune the channel.
4. Play one movie and one series episode. Check pause, 10-second seeking, resume, Back, and next-episode countdown.
5. On a multilingual stream, open subtitle selection. Verify the preferred subtitle language, manual selection, and Off. Confirm the main/default audio remains audible.
6. Check Movies and Series pages with more than 20 entries, a language/category filter, page navigation, search, and D-pad focus return to the toolbar and sidebar.
7. Create a second profile. Save a title and watch part of a movie. Switch profiles and confirm favorites, history, and subtitle preference are separate; switch back and confirm the original state returns.
8. In Settings, confirm backup and diagnostics appear. Export an encrypted backup, verify wrong-password restore is rejected, then restore with the correct password. Confirm the app reloads and the provider/profile settings return.
9. Clear cached catalog and guide data in Settings. Confirm favorites, profiles, history, and saved login remain. Restart and confirm the catalog rebuilds.
10. Disconnect and reconnect. Confirm the remembered login behaves as intended.
11. Interrupt the network during a stream and reconnect it. Confirm an error or recovery state appears and the app remains navigable. Return to the app after pressing Home and check for a black screen.

## Provider-dependent checks

- If the provider supplies XMLTV or `get_simple_data_table`, confirm now/next and the timeline. Test a manual EPG mapping if needed.
- If the provider advertises archive support, test Replay and Start Over on an actual archived program. EPG listings alone do not confirm archive playback.
- Check embedded and external subtitle streams separately; availability depends on the stream and TV decoder.

Record failures with the channel/title, time, stream format, and visible error message. Do not include provider passwords or stream URLs in screenshots or reports.
