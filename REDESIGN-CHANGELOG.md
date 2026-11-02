# Atelier redesign

- Replaced the previous visual system with a warm editorial / botanical identity: parchment surfaces, deep evergreen, muted mint and apricot details.
- Rebuilt the responsive layout around a desktop navigation rail and compact five-item mobile dock.
- Refined the dashboard, chat workspace, task cards, calendar, memories, settings, dialogs, toasts and empty states.
- Added a custom CSS mini-robot with idle float, eye blink, antenna glow and a small wave; respects reduced-motion preferences.
- Replaced app icons and manifest colors; bumped the service-worker cache to `meri-assistant-atelier-v1`.
- Removed remote font loading; uses system font stack for faster, offline-friendly startup.
- Preserved `worker.js` byte-for-byte and kept the existing API contract and localStorage keys.
