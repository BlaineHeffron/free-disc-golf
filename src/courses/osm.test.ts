import { describe, expect, it } from 'vitest';
import { buildDataset, decodeCourse, osmUrl } from './osm';
import { osmFixture } from './fixture.test-data';

describe('buildDataset', () => {
  const rows = buildDataset([...osmFixture].reverse());
  const byId = Object.fromEntries(rows.map((r) => [r[0], r]));

  it('emits each course once, sorted by type then numeric id, deduping sport=disc_golf duplicates', () => {
    expect(rows.map((r) => r[0])).toEqual(['n5001', 'n5002', 'r4001', 'w1001', 'w1003']);
    expect(buildDataset([...osmFixture, ...osmFixture])).toEqual(rows);
  });

  it('builds holes inside the outline: ref numbering, par default 3, first duplicate wins, node fallback', () => {
    expect(byId.w1001).toEqual([
      'w1001',
      'Pier Park DGC',
      45.5,
      -122.6,
      [
        [1, 3, 45.4992, -122.601, 45.4997, -122.601],
        [2, 4, 45.4995, -122.6, 45.5004, -122.6],
        [3, 3, 45.50051, -122.60211, 45.5005, -122.602],
      ],
    ]);
  });

  it('assigns relation members, nearest holes within 1 km, and falls back to hole-count tags or 18', () => {
    expect(byId.r4001[4]).toEqual([[1, 3, 45.7, -122.9, 45.7005, -122.9]]);
    expect(byId.n5001[4]).toEqual([[4, 3, null, null, 45.8027, -122.8]]);
    expect(byId.n5002.slice(1)).toEqual(['Quiet Woods', 46, -123, 18]);
    expect(byId.w1003[4]).toBe(18);
  });

  it('keeps a partial hole (tee only), and compacts plain par-3 layouts to a count', () => {
    const course = { type: 'node' as const, id: 1, lat: 0, lon: 0, tags: { leisure: 'disc_golf_course' } };
    const tee = (id: number, ref: string) => ({ type: 'node' as const, id, lat: 0, lon: 0.001, tags: { disc_golf: 'tee', ref } });
    expect(buildDataset([course, tee(2, '2')])[0][4]).toEqual([[2, 3, 0, 0.001]]);
    expect(buildDataset([course])[0][4]).toBe(18);
  });

  it('handles empty input', () => {
    expect(buildDataset([])).toEqual([]);
  });
});

describe('decodeCourse', () => {
  it('turns rows into app courses with lengths and the existing osm id scheme', () => {
    const [n5001, , r4001, w1001] = buildDataset(osmFixture).map(decodeCourse);
    expect(w1001).toMatchObject({ id: 'osm:way/1001', name: 'Pier Park DGC', location: { lat: 45.5, lng: -122.6 }, source: 'osm' });
    expect(w1001.holes.map((h) => [h.number, h.par, h.lengthMeters])).toEqual([[1, 3, 56], [2, 4, 100], [3, 3, 9]]);
    expect(r4001).toMatchObject({ id: 'osm:relation/4001', name: 'Unnamed course' });
    expect(n5001.holes).toEqual([{ number: 4, par: 3, basket: { lat: 45.8027, lng: -122.8 } }]);
  });

  it('expands hole counts to par-3 holes', () => {
    expect(decodeCourse(['n1', 'A', 1, 2, 2]).holes).toEqual([{ number: 1, par: 3 }, { number: 2, par: 3 }]);
  });

  it('links to the course on openstreetmap.org', () => {
    expect(osmUrl('osm:way/1001')).toBe('https://www.openstreetmap.org/way/1001');
  });
});
