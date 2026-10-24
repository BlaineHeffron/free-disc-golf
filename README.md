# Free Disc Golf

A free, open-source disc golf scorecard. No accounts, no paywall, no tracking.
Installable as a PWA on Android and iOS; works offline once loaded.

## Features
- **Course recognition** – a worldwide OpenStreetMap course dataset ships with
  the app and is stored on the device, so finding nearby courses (within 50 km)
  and recognizing the one you're standing at (within 500 m) works offline, with
  no live map queries. Search finds any course worldwide by name. Hole
  pars/positions come from mapped holes; otherwise a par-3 default layout.
  Create custom courses when one isn't mapped.
- **Score tracking** – multiple players, big one-handed +/- buttons, editable
  par, scorecard grid, leaderboard, resumable rounds, round history.
- All data stays on your device (localStorage).

Missing hole data for your local course? Add it to OpenStreetMap and everyone benefits.

## Course layouts

Courses come from three places, all stored on the device:

| source | where it comes from | storage key |
| --- | --- | --- |
| `osm` | bundled `public/courses.json` (service-worker cached) | — |
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

## Course data

`public/courses.json` is built from OpenStreetMap by `scripts/build-courses.mjs`
(pure logic in `src/courses/osm.ts`, unit-tested) and rebuilt weekly by
`.github/workflows/build-courses.yml`, which commits it only when it changed.
Rebuild locally with `npm run build:courses` (Node ≥ 22.6; ~15 min — one
worldwide query per tag against public Overpass servers, with pauses, backoff and
server rotation; a query too big for a server is split into map quadrants). If any
request still fails the script exits non-zero and leaves the existing file untouched.

What is included:
- courses: `leisure=disc_golf_course`, `type=disc_golf_course` relations, and
  `sport=disc_golf` features that look like a whole course (an area or a named
  point that is not a tee/basket/hole, and not within 500 m of a course above);
- holes: `disc_golf=hole` ways (`ref` = number, `par`, endpoints = tee/basket)
  and `disc_golf=tee`/`basket` nodes, assigned to a course by relation membership,
  else by lying inside the course outline, else to the nearest course within 1 km.
  Courses without hole data get `holes`/`disc_golf:holes` (or 18) par-3 holes.

Format (one course per line, sorted by id so weekly diffs stay small):

```
{"format":1,"license":"ODbL-1.0",...,"courses":[
["w1001","Pier Park DGC",45.5,-122.6,[[1,3,45.4992,-122.601,45.4997,-122.601],[2,4]]],
["n5001","Backyard Baskets",45.59,-122.6,9]
]}
```

Each row is `[id, name, lat, lng, holes]`: `id` is the OSM type initial
(`n`/`w`/`r`) + id, `name` may be empty, coordinates have 5 decimals. `holes` is
either a count (holes 1..n, all par 3) or a list of
`[number, par, teeLat?, teeLng?, basketLat?, basketLng?]` (tee is `null,null`
when only the basket is known). Hole length is computed in the app.

The dataset is © OpenStreetMap contributors and offered under the
[ODbL](https://opendatacommons.org/licenses/odbl/1-0/) — see
`public/courses.LICENSE.txt`. Fix or add holes on OpenStreetMap (the app links to
each course) and the next weekly build picks it up.

## Develop
```
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + lint
npm test
npm run build
npm run build:courses   # refresh public/courses.json from OpenStreetMap
```

Course data © OpenStreetMap contributors, ODbL (`public/courses.json`). Code: MIT.
