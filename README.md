# Meri Assistant — Complete Project

This archive contains the complete PWA frontend and the existing Cloudflare Worker backend.

## Included
- `index.html` — responsive app interface, chat composer, mini-robot welcome animation, tasks, memories, calendar, settings, search, voice controls and weekly progress
- `worker.js` — Cloudflare Worker backend; retains the existing `/api/chat`, `/api/memory`, `/api/settings`, `/api/state`, `/api/subscribe`, `/api/task`, `/api/task/update` and `/api/test-push` routes
- `sw.js` — service worker and offline/PWA caching
- `manifest.webmanifest` and supplied app icons/logo
- `SETUP.md` — deployment and configuration instructions

## Backend compatibility
The existing Worker bindings and API contract are retained:
- KV namespace binding: `KV`
- Cloudflare Worker secrets: `GEMINI_API_KEY` and `APP_KEY`
- Optional variable: `GEMINI_MODEL`
- Frontend sends the app key using the `x-app-key` header

The Worker includes one backward-compatible additive memory-edit action. Existing chat, task, memory, state, settings and push routes remain in place.

## Security — important
**No API keys, Cloudflare tokens, private keys or live app secrets are included in this ZIP.**
Add `GEMINI_API_KEY` and `APP_KEY` only under Cloudflare Worker → Settings → Variables and Secrets, with type **Secret**. Never paste them into `index.html`, `worker.js`, or a public GitHub repository.

## Deploy
Follow `SETUP.md`. Upload the app files to GitHub Pages and deploy `worker.js` separately as a Cloudflare Worker. Configure the Worker secrets and KV binding before connecting the app.

## Notes
- Push notifications require HTTPS, notification permission, a valid VAPID key and backend support.
- Browser speech recognition/synthesis availability depends on the browser and device.
- The app can be installed as a PWA from a supported browser.
