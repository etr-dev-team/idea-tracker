# Ideas

A tiny, offline-first PWA for capturing ideas fast and reviewing them later.
No accounts, no backend, no build step — just static files.

- **Fast capture** — one text field, `Enter` saves, `Shift+Enter` adds a line.
- **Review** — newest first, pin favourites, search, edit, copy, delete with undo.
- **Stays yours** — ideas live in `localStorage` on your device. Export/import JSON for backup or moving between devices.
- **Works offline** — service worker caches the app shell.
- **Installable** — add to home screen / desktop as a standalone app.
- **Light and dark** — follows your system theme, with a manual toggle.

## Run locally

```sh
python3 -m http.server 4173
# open http://localhost:4173
```

Any static file server works. Opening `index.html` directly mostly works, but
service workers (offline support) need `http(s)`.

## Deploy

The whole app is static, so anything that serves files works:

- **Vercel** – `vercel` (or drag the folder into the dashboard). No config needed.
- **Netlify** – drag the folder into the Netlify dashboard.
- **Cloudflare Pages** – connect the repo, leave build command empty, output directory `/`.
- **GitHub Pages** – push to a repo, enable Pages. All paths are relative, so it works from a subpath too.
- **Any VPS / S3 / nginx** – copy the files.

## Install as an app

- **Android / Desktop Chrome** – click the `Install` button in the header (or the install icon in the address bar).
- **iOS Safari** – Share → Add to Home Screen.

## Where data lives

Ideas are stored under the `idea-tracker:v1` key in `localStorage`, scoped to the
origin you serve the app from. Changing domain, browser, or device means fresh,
empty storage. Use **Export** / **Import** to back up or migrate.

The app has no server and sends nothing anywhere.

## Files

```
index.html              app shell
styles.css              theme + layout
app.js                  all logic
sw.js                   offline cache
manifest.webmanifest    PWA metadata
icons/                  generated icons
scripts/make-icons.mjs  regenerate icons (node scripts/make-icons.mjs)
```

## Customizing

- **Theme colors** – CSS variables at the top of `styles.css`.
- **App name** – `index.html` (title, `apple-mobile-web-app-title`) and `manifest.webmanifest`.
- **Icons** – edit `scripts/make-icons.mjs`, run `node scripts/make-icons.mjs`.

When changing `index.html`, `styles.css`, `app.js`, or icons, bump `CACHE` in
`sw.js` (e.g. `ideas-v1` → `ideas-v2`) so returning visitors get the update
immediately on their next load.
