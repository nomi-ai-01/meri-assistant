# Meri Assistant PWA

## Deploy
1. Upload every file in this folder to your GitHub Pages publish directory.
2. Enable GitHub Pages and open the HTTPS URL.
3. Complete first-run setup with your Worker URL and app key.

## Project files
- index.html: single-file application (HTML, CSS, JS)
- manifest.webmanifest: install metadata
- sw.js: versioned same-origin network-first cache and push handlers
- logo-mark.png, favicon.png, apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png: supplied-brand assets

## Backend
Uses the configured Worker with `x-app-key`, JSON content type, and a 75-second request timeout. Keep the backend contract and storage key names documented in the project source.

## Notes
- Push requires HTTPS, notification permission, a valid VAPID public key, and backend support.
- Browser speech recognition/synthesis support varies.
- Priority is a client-side enhancement because priority is not part of the supplied task schema.
- Calendar Hijri estimates can vary; confirm dates for official Pakistani observances.


## Premium interface update (2026-11)
- Added the animated mini robot companion and a short first-open logo/robot reveal.
- Added quick actions for tasks, memories, voice input, and chat.
- Added universal search across locally stored chats, tasks, and memories.
- Added a seven-day completion overview and overdue-task count.
- Added a cache version bump so installed PWAs refresh the updated interface.

## Backend/API compatibility
`worker.js` was intentionally left unchanged. The existing Worker routes, KV state format,
`GEMINI_API_KEY`, `APP_KEY`, `GEMINI_MODEL`, and frontend `x-app-key` request contract remain
as supplied. Configure secrets in Cloudflare Worker settings; do not paste secret API keys
into public frontend files or commit them to GitHub.
