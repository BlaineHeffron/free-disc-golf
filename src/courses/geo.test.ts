import { describe, expect, it } from 'vitest';
import type { Course } from '../types';
import { formatDistance, haversine, recognize, sortByDistance } from './geo';

const course = (id: string, lat: number, lng: number): Course => ({ id, name: id, location: { lat, lng }, holes: [], source: 'osm' });

describe('haversine', () => {
  it('is zero for the same point and ~111 km per degree of latitude', () => {
    expect(haversine({ lat: 10, lng: 10 }, { lat: 10, lng: 10 })).toBe(0);
    expect(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1);
  });
  it('matches a known city pair (Paris–London ≈ 344 km)', () => {
    expect(haversine({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 }) / 1000).toBeCloseTo(343.5, 0);
  });
});

describe('recognition', () => {
  const here = { lat: 45.5, lng: -122.6 };
  const near = course('near', 45.503, -122.6); // ~334 m
  const far = course('far', 45.6, -122.6); // ~11 km

  it('sorts courses by distance', () => {
    expect(sortByDistance([far, near], here).map((d) => d.course.id)).toEqual(['near', 'far']);
  });
  it('recognizes the nearest course within 500 m', () => {
    expect(recognize([far, near], here)?.course).toBe(near);
  });
  it('recognizes nothing when the nearest course is beyond 500 m', () => {
    expect(recognize([far], here)).toBeNull();
    expect(recognize([], here)).toBeNull();
  });
  it('formats distances', () => {
    expect(formatDistance(334.4)).toBe('334 m');
    expect(formatDistance(11120)).toBe('11.1 km');
  });
});
