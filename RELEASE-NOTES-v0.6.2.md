# NextFlix v0.6.2

- Replaced TMDB metadata lookup with optional OMDb metadata; enter your own OMDb key in Settings.
- Improved directional key handling and scroll cues, and tightened search field sizing.
- Removed EPG/XMLTV and catch-up code to reduce background work and improve responsiveness.
- Kept OpenSubtitles account configuration and playback controls.
- Improved the OMDb message shown when an API key is rejected. A 401/403 means OMDb did not accept the key; verify it is copied correctly and activated through OMDb's email.

The package contains no provider credentials or API keys. IPTV playback and OMDb access should be tested on the target TV after installation.
