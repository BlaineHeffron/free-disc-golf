import { describe, expect, it } from 'vitest';
import { buildQuery, parseOverpass } from './overpass';
import { overpassFixture } from './fixture.test-data';

describe('buildQuery', () => {
  it('queries disc golf courses around a point with hole data', () => {
    const q = buildQuery({ lat: 45.5, lng: -122.6 }, 25000);
    expect(q).toContain('[out:json][timeout:25]');
    expect(q).toContain('nwr["leisure"="disc_golf_course"](around:25000,45.5,-122.6)');
  });
});

describe('parseOverpass', () => {
  const courses = parseOverpass(overpassFixture);

  it('parses every course with id, name, and centroid', () => {
    expect(courses.map((c) => [c.id, c.name, c.location])).toEqual([
      ['osm:way/1001', 'Pier Park DGC', { lat: 45.5, lng: -122.6 }],
      ['osm:relation/4001', 'Unnamed course', { lat: 45.6, lng: -122.7 }],
      ['osm:node/5001', 'Backyard Baskets', { lat: 45.7, lng: -122.8 }],
    ]);
    expect(courses.every((c) => c.source === 'osm')).toBe(true);
  });

  it('builds sorted holes from hole ways and tee/basket nodes', () => {
    const [h1, h2, h3] = courses[0].holes;
    expect(courses[0].holes).toHaveLength(3);
    expect(h1).toMatchObject({ number: 1, par: 3, tee: { lat: 45.501, lng: -122.601 }, basket: { lat: 45.5015, lng: -122.601 } });
    expect(h1.lengthMeters).toBe(56);
    expect(h2).toMatchObject({ number: 2, par: 4, tee: { lat: 45.5, lng: -122.6 }, basket: { lat: 45.5009, lng: -122.6 }, lengthMeters: 100 });
    expect(h3).toMatchObject({ number: 3, par: 3, tee: { lat: 45.5021, lng: -122.6021 }, basket: { lat: 45.502, lng: -122.602 } });
  });

  it('falls back to the hole-count tag, then 18, all par 3', () => {
    expect(courses[1].holes).toHaveLength(9);
    expect(courses[2].holes).toHaveLength(18);
    expect(courses[2].holes.every((h, i) => h.number === i + 1 && h.par === 3 && !h.tee)).toBe(true);
  });

  it('handles empty input', () => {
    expect(parseOverpass({})).toEqual([]);
  });
});
