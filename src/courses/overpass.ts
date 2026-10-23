import type { Course, Hole, LatLng } from '../types';
import { haversine } from './geo';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/**
 * One request: each course is followed in the output by the hole ways and tee/basket nodes inside
 * its area (node-only courses have no area, so they get none). `parseOverpass` relies on that order.
 */
export function buildQuery({ lat, lng }: LatLng, radiusMeters: number): string {
  return `[out:json][timeout:25];
nwr["leisure"="disc_golf_course"](around:${Math.round(radiusMeters)},${lat},${lng})->.courses;
foreach.courses->.c(
  .c out center tags;
  .c map_to_area->.a;
  (way(area.a)["golf"="hole"];node(area.a)["disc_golf"~"^(tee|basket)$"];);
  out geom;
);`;
}

const ll = (p: { lat: number; lon: number }): LatLng => ({ lat: p.lat, lng: p.lon });
const int = (s: string | undefined) => {
  const n = parseInt(s ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function buildHoles(course: OsmElement, members: OsmElement[]): Hole[] {
  const byNumber = new Map<number, Hole>();
  const hole = (n: number) => byNumber.get(n) ?? byNumber.set(n, { number: n, par: 3 }).get(n)!;
  for (const el of members) {
    const n = int(el.tags?.ref);
    if (!n) continue;
    if (el.type === 'way') {
      const h = hole(n);
      h.par = int(el.tags?.par) ?? h.par;
      const g = el.geometry;
      if (g && g.length >= 2) {
        h.tee = ll(g[0]);
        h.basket = ll(g[g.length - 1]);
      }
    } else if (el.lat !== undefined && el.lon !== undefined) {
      const h = hole(n);
      if (el.tags?.disc_golf === 'tee') h.tee ??= ll({ lat: el.lat, lon: el.lon });
      else h.basket ??= ll({ lat: el.lat, lon: el.lon });
    }
  }
  const holes = [...byNumber.values()].sort((a, b) => a.number - b.number);
  for (const h of holes) if (h.tee && h.basket) h.lengthMeters = Math.round(haversine(h.tee, h.basket));
  if (holes.length) return holes;
  const count = Math.min(int(course.tags?.holes) ?? int(course.tags?.['disc_golf:holes']) ?? 18, 99);
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par: 3 }));
}

/** Pure: Overpass JSON (from `buildQuery`) -> courses. */
export function parseOverpass(json: { elements?: OsmElement[] }): Course[] {
  const groups: { course: OsmElement; members: OsmElement[] }[] = [];
  for (const el of json.elements ?? []) {
    if (el.tags?.leisure === 'disc_golf_course') groups.push({ course: el, members: [] });
    else groups[groups.length - 1]?.members.push(el);
  }
  const seen = new Set<string>();
  return groups.flatMap(({ course, members }) => {
    const id = `osm:${course.type}/${course.id}`;
    const p = course.center ?? (course.lat !== undefined ? { lat: course.lat, lon: course.lon! } : null);
    if (!p || seen.has(id)) return [];
    seen.add(id);
    const name = course.tags?.name?.trim() || 'Unnamed course';
    return [{ id, name, location: ll(p), holes: buildHoles(course, members), source: 'osm' as const }];
  });
}

export async function fetchCourses(center: LatLng, radiusMeters = 25000, timeoutMs = 30000): Promise<Course[]> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: new URLSearchParams({ data: buildQuery(center, radiusMeters) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(res.status === 429 ? 'Course server is busy, try again shortly' : `Course lookup failed (${res.status})`);
  return parseOverpass(await res.json());
}
