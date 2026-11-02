# Security and secrets

This source archive intentionally contains no live API keys or Cloudflare credentials.

Configure these values as Cloudflare Worker secrets:
- `GEMINI_API_KEY`
- `APP_KEY`

Do not commit secret values to GitHub and do not add them to the frontend. The frontend stores the Worker URL and app key in its local setup on the user's device; the Gemini API key stays server-side in Cloudflare.

If a secret was ever committed publicly, rotate it in the provider dashboard.
