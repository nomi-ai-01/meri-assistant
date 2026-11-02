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
