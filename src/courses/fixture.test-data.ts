// Realistic Overpass response for `buildQuery` output (hand-written, fictional IDs/coords).
import type { OsmElement } from './overpass';
export const overpassFixture: { elements: OsmElement[] } & Record<string, unknown> = {
  version: 0.6,
  generator: 'Overpass API 0.7.62',
  osm3s: { copyright: 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.' },
  elements: [
    {
      type: 'way',
      id: 1001,
      center: { lat: 45.5, lon: -122.6 },
      tags: { leisure: 'disc_golf_course', name: 'Pier Park DGC', holes: '18' },
    },
    {
      type: 'way',
      id: 2002,
      geometry: [
        { lat: 45.5, lon: -122.6 },
        { lat: 45.5004, lon: -122.6 },
        { lat: 45.5009, lon: -122.6 },
      ],
      tags: { golf: 'hole', ref: '2', par: '4' },
    },
    {
      type: 'way',
      id: 2001,
      geometry: [
        { lat: 45.501, lon: -122.601 },
        { lat: 45.5015, lon: -122.601 },
      ],
      tags: { golf: 'hole', ref: '1' },
    },
    { type: 'node', id: 3001, lat: 45.502, lon: -122.602, tags: { disc_golf: 'basket', ref: '3' } },
    { type: 'node', id: 3002, lat: 45.5021, lon: -122.6021, tags: { disc_golf: 'tee', ref: '3' } },
    {
      type: 'relation',
      id: 4001,
      center: { lat: 45.6, lon: -122.7 },
      tags: { leisure: 'disc_golf_course', 'disc_golf:holes': '9' },
    },
    { type: 'node', id: 5001, lat: 45.7, lon: -122.8, tags: { leisure: 'disc_golf_course', name: 'Backyard Baskets' } },
  ],
};
