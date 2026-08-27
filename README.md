# Swatchy

Pull a color out of a photo, name it, and share it. Take or upload a photo,
press anywhere on it to sample a color, give it a name, then save it to your
profile or post it to the shared home feed.

- **Claim** — press-and-drag on a photo to sample a color with a live loupe;
  lift your finger to claim it (one color per photo).
- **Home** — every color posted on this device, each with a full-width color
  band and the photo it came from.
- **Discover** — search and browse every named color across all posts.
- **Profile** — your saved colors and your own posts.

Built with Expo Router (SDK 54) + TypeScript. All storage is local
(AsyncStorage + the device filesystem) — no backend yet.

## Development

```bash
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your phone, or press
`w` for the web build.

## Weekly palettes

The weekly challenge runs off a curated queue. An admin adds palettes by hex
from **Profile → Weekly palettes**, and the first request in a new ISO week
promotes the next one in line — so the swap happens Monday 00:00 UTC without a
scheduler. A week that starts with an empty queue gets a generated palette
instead (`weeklyPalette()` in `server/index.js`), which is then pinned for that
week like any other.

Who can curate is the `ADMIN_EMAILS` env var on the API service — a
comma-separated list of Clerk account emails, defaulting to the repo owner's.

## Web build (production)

```bash
npm run build:web   # expo export -p web -> ./dist
npm run serve:web   # serve ./dist on $PORT (defaults to 3000)
```

This is what `railway.json` runs in production. Note: photo persistence
relies on `expo-file-system`'s native APIs, which aren't available on web —
posted photos on the web build won't survive a page reload. The mobile app
(Expo Go / a native build) doesn't have this limitation.
