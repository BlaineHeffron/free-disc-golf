import { describe, expect, it } from 'vitest';
import { LayoutError, courseToLayout, layoutToCourse, parseLayout, readLayoutFile } from './layout';
import type { Course } from '../types';

const holes = [
  { number: 1, par: 3, lengthMeters: 91, tee: { lat: 45.5, lng: -122.6 }, basket: { lat: 45.5008, lng: -122.6 } },
  { number: 2, par: 4 },
];

describe('parseLayout', () => {
  it('reads the canonical dg-layout format', () => {
    const layout = parseLayout({
      format: 'dg-layout',
      version: 1,
      id: 'manual:dog-wood',
      name: 'Dog Wood Park',
      layoutName: 'Blue tees',
      location: { lat: 30.2, lng: -81.6 },
      source: 'osm',
      capturedAt: '2026-10-23',
      holes,
    });
    expect(layout.id).toBe('manual:dog-wood');
    expect(layout.source).toBe('osm');
    expect(layout.holes).toHaveLength(2);
    expect(layout.holes[0].tee).toEqual({ lat: 45.5, lng: -122.6 });
  });

  it('accepts loose shapes and normalizes key spelling', () => {
    const layout = parseLayout({
      name: 'Loose Course',
      latitude: 45.1,
      longitude: -122.2,
      holes: [{ hole: 2, par: '4', length: 120.4, tee: { lat: 1, lon: 2 }, basket: { latitude: 3, longitude: 4 } }],
    } as unknown);
    expect(layout.name).toBe('Loose Course');
    expect(layout.location).toEqual({ lat: 45.1, lng: -122.2 });
    expect(layout.holes[0]).toMatchObject({ number: 2, par: 4, lengthMeters: 120 });
  });

  it('accepts a bare hole array and sorts + defaults', () => {
    const layout = parseLayout([{ number: 3, par: 4 }, { number: 1, par: 3 }]);
    expect(layout.holes.map((h) => h.number)).toEqual([1, 3]);
    expect(layout.holes[0].par).toBe(3);
    expect(layout.name).toBe('Imported course');
  });

  it('rejects duplicate hole numbers', () => {
    expect(() => parseLayout([{ number: 1, par: 3 }, { number: 1, par: 4 }])).toThrow(LayoutError);
  });

  it('rejects out-of-range coordinates and lengths', () => {
    expect(() => parseLayout({ holes, location: { lat: 999, lng: 0 } })).not.toThrow(); // location falls back
    expect(() => parseLayout([{ number: 1, par: 3, lengthMeters: 99999 }])).toThrow(LayoutError);
    expect(() => parseLayout([{ number: 1, par: 99 }])).toThrow(LayoutError);
  });

  it('rejects an empty layout', () => {
    expect(() => parseLayout({ holes: [] })).toThrow('layout has no holes');
  });
});

describe('courseToLayout / layoutToCourse', () => {
  const course: Course = {
    id: 'custom:abc',
    name: 'Pier Park DGC',
    location: { lat: 45.6, lng: -122.7 },
    source: 'layout',
    holes: [
      { number: 1, par: 3, lengthMeters: 91 },
      { number: 2, par: 4, tee: { lat: 1, lng: 2 }, basket: { lat: 3, lng: 4 } },
    ],
  };

  it('round-trips geometry and par', () => {
    const back = layoutToCourse(courseToLayout(course));
    expect(back.id).toBe(course.id);
    expect(back.name).toBe(course.name);
    expect(back.source).toBe('layout');
    expect(back.holes).toEqual(course.holes);
  });

  it('appends the layout name so two layouts of one course stay distinct', () => {
    const layout = parseLayout({ name: 'Pier Park', layoutName: 'Short', holes });
    expect(layoutToCourse(layout).name).toBe('Pier Park (Short)');
  });
});

describe('readLayoutFile', () => {
  it('parses a file and falls back to the filename for the name', async () => {
    const file = new File([JSON.stringify([{ number: 1, par: 3 }])], 'pier-park.json', { type: 'application/json' });
    const course = await readLayoutFile(file);
    expect(course.name).toBe('pier-park');
    expect(course.holes).toHaveLength(1);
  });

  it('reports invalid JSON instead of throwing a parse error', async () => {
    const file = new File(['not json'], 'broken.json', { type: 'application/json' });
    await expect(readLayoutFile(file)).rejects.toThrow('broken.json is not valid JSON');
  });
});
