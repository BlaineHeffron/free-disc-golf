import type { Course, LatLng } from '../types';

const R = 6371000; // mean Earth radius, meters
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface CourseDistance {
  course: Course;
  meters: number;
}

export function sortByDistance(courses: Course[], from: LatLng): CourseDistance[] {
  return courses
    .map((course) => ({ course, meters: haversine(from, course.location) }))
    .sort((a, b) => a.meters - b.meters);
}

/** The nearest course if it is within `maxMeters` (default 500 m) — i.e. "you're at it". */
export function recognize(courses: Course[], from: LatLng, maxMeters = 500): CourseDistance | null {
  const [nearest] = sortByDistance(courses, from);
  return nearest && nearest.meters <= maxMeters ? nearest : null;
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
