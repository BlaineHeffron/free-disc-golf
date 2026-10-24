// Realistic Overpass `out geom` elements as fetched by scripts/build-courses.mjs (hand-written, fictional IDs/coords).
import type { OsmElement } from './osm';

const box = (s: number, w: number, n: number, e: number) => ({
  bounds: { minlat: s, minlon: w, maxlat: n, maxlon: e },
  geometry: [
    { lat: s, lon: w },
    { lat: n, lon: w },
    { lat: n, lon: e },
    { lat: s, lon: e },
    { lat: s, lon: w },
  ],
});

export const osmFixture: OsmElement[] = [
  // Outlined course; its holes lie inside the outline.
  { type: 'way', id: 1001, ...box(45.499, -122.603, 45.501, -122.597), tags: { leisure: 'disc_golf_course', name: 'Pier Park DGC', holes: '18' } },
  { type: 'way', id: 2002, geometry: [{ lat: 45.4995, lon: -122.6 }, { lat: 45.5, lon: -122.6 }, { lat: 45.5004, lon: -122.6 }], tags: { disc_golf: 'hole', ref: '2', par: '4' } },
  { type: 'way', id: 2001, geometry: [{ lat: 45.4992, lon: -122.601 }, { lat: 45.4997, lon: -122.601 }], tags: { disc_golf: 'hole', ref: '1' } },
  { type: 'way', id: 2003, geometry: [{ lat: 45.4993, lon: -122.602 }, { lat: 45.4994, lon: -122.602 }], tags: { disc_golf: 'hole', ref: '1', par: '5' } }, // duplicate ref
  { type: 'node', id: 3001, lat: 45.5005, lon: -122.602, tags: { disc_golf: 'basket', ref: '3' } },
  { type: 'node', id: 3002, lat: 45.50051, lon: -122.60211, tags: { disc_golf: 'tee', ref: '3' } },
  // A park tagged sport=disc_golf around it is the same course, not a second one.
  { type: 'way', id: 1002, ...box(45.498, -122.604, 45.502, -122.596), tags: { leisure: 'park', sport: 'disc_golf', name: 'Pier Park' } },
  // Course relation with explicit hole members (the hole is far outside any outline).
  { type: 'relation', id: 4001, bounds: { minlat: 45.6, minlon: -122.7, maxlat: 45.62, maxlon: -122.68 }, members: [{ type: 'way', ref: 2101, role: 'hole' }], tags: { type: 'disc_golf_course', 'disc_golf:holes': '9' } },
  { type: 'way', id: 2101, geometry: [{ lat: 45.7, lon: -122.9 }, { lat: 45.7005, lon: -122.9 }], tags: { disc_golf: 'hole', ref: '1', par: '3' } },
  // Node-only course: a basket 300 m away joins it; one 3 km away does not.
  { type: 'node', id: 5001, lat: 45.8, lon: -122.8, tags: { leisure: 'disc_golf_course', name: 'Backyard Baskets', holes: '9' } },
  { type: 'node', id: 3101, lat: 45.8027, lon: -122.8, tags: { disc_golf: 'basket', ref: '4' } },
  { type: 'node', id: 3102, lat: 45.827, lon: -122.8, tags: { disc_golf: 'basket', ref: '5' } },
  // Untagged-count course with no holes; a sport=disc_golf pitch elsewhere counts as a course; a lone tee pad, a shop and a numbered point do not.
  { type: 'node', id: 5002, lat: 46, lon: -123, tags: { leisure: 'disc_golf_course', name: ' Quiet Woods ' } },
  { type: 'way', id: 1003, ...box(47, -123, 47.002, -122.998), tags: { leisure: 'pitch', sport: 'soccer;disc_golf' } },
  { type: 'node', id: 3201, lat: 48, lon: -123, tags: { sport: 'disc_golf', disc_golf: 'tee' } },
  { type: 'node', id: 6001, lat: 49, lon: -123, tags: { sport: 'disc_golf', shop: 'sports', name: 'Disc Shop' } },
  { type: 'node', id: 6002, lat: 49.5, lon: -123, tags: { sport: 'disc_golf', name: '8' } }, // a hole number, not a course
];
