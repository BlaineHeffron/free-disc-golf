# Free Disc Golf

A free, open-source disc golf scorecard. No accounts, no paywall, no tracking.
Installable as a PWA on Android and iOS; works offline once loaded.

## Features
- **Course recognition** – finds nearby courses from OpenStreetMap
  (`leisure=disc_golf_course`) and recognizes the one you're standing at.
  Hole pars/positions come from `golf=hole` ways when mapped; otherwise a
  par-3 default layout. Create custom courses when one isn't mapped.
- **Score tracking** – multiple players, big one-handed +/- buttons, editable
  par, scorecard grid, leaderboard, resumable rounds, round history.
- All data stays on your device (localStorage).

Missing hole data for your local course? Add it to OpenStreetMap and everyone benefits.

## Course layouts

Courses come from three places, all stored on the device:

| source | where it comes from | storage key |
| --- | --- | --- |
| `osm` | live Overpass query, cached | `dg.courses.osm` |
| `custom` | created by you | `dg.courses.custom` |
| `layout` | imported `.json` files | `dg.courses.layouts` |

A layout file is plain JSON (`src/courses/layout.ts` is the schema + validator):

```json
{
  "format": "dg-layout",
  "version": 1,
  "id": "manual:dog-wood-park",
  "name": "Dog Wood Park",
  "layoutName": "Blue Tees",
  "location": { "lat": 30.2089, "lng": -81.6442 },
  "source": "manual",
  "capturedAt": "2026-10-23",
  "holes": [
    { "number": 1, "par": 3, "lengthMeters": 260,
      "tee": { "lat": 30.2091, "lng": -81.644 },
      "basket": { "lat": 30.2099, "lng": -81.6435 } }
  ]
}
```

Import one from the course screen (**Import course layout**).

## Develop
```
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + lint
npm test
npm run build
```

Course data © OpenStreetMap contributors, ODbL. Code: MIT.
