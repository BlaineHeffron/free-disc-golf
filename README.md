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

## Develop
```
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + lint
npm test
npm run build
```

Course data © OpenStreetMap contributors, ODbL. Code: MIT.
