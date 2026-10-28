# NextFlix v1.0.14 credential persistence fix

- Save the remembered provider login to a dedicated IndexedDB database as well as localStorage.
- Restore credentials from the TV database if the legacy localStorage copy is unavailable.
- Keep login settings separate from rebuildable catalog cache cleanup.

Build and package verification passed. Confirm credentials persist after restarting NextFlix on the LG C9.
