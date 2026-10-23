// Pure OpenStreetMap -> bundled course dataset logic. Shared by the app (decode) and
// scripts/build-courses.mjs (build), so it must stay runnable by Node's type stripping:
// erasable TS only, relative imports with explicit `.ts`.
import type { Course, Hole, LatLng } from '../types';
import { haversine } from './geo.ts';

type Pt = { lat: number; lon: number };
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Pt[];
  members?: { type: string; ref: number; role: string; geometry?: Pt[] }[];
  tags?: Record<string, string>;
}

/** Hole: [number, par] then optional tee lat,lng then optional basket lat,lng (tee may be null,null). */
export type HoleRow = (number | null)[];
/** Course: [id ("w123"/"n123"/"r123"), name, lat, lng, holes]. holes is a count (holes 1..n, all par 3) or HoleRows. */
export type CourseRow = [string, string, number, number, number | HoleRow[]];

const ASSIGN_METERS = 1000; // holes outside any course outline join the nearest course this close
const DUPLICATE_METERS = 500; // sport=disc_golf-only features this close to a real course are the same course

const key = (el: { type: string; id?: number; ref?: number }) => `${el.type[0]}${el.id ?? el.ref}`;
const round = (x: number) => Math.round(x * 1e5) / 1e5;
const ll = (p: Pt): LatLng => ({ lat: round(p.lat), lng: round(p.lon) });
const int = (s: string | undefined) => {
  const n = parseInt(s ?? '', 10);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : undefined;
};
const sports = (el: OsmElement) => (el.tags?.sport ?? '').split(';').map((s) => s.trim());

const isPrimaryCourse = (el: OsmElement) =>
  el.tags?.leisure === 'disc_golf_course' || (el.type === 'relation' && el.tags?.type === 'disc_golf_course');
/** `sport=disc_golf` features that look like a whole course: not a hole/tee/basket, and an area or a named point. */
const isSportCourse = (el: OsmElement) =>
  sports(el).includes('disc_golf') && !el.tags?.disc_golf && !el.tags?.golf && (el.type !== 'node' || !!el.tags?.name);
const isHolePart = (el: OsmElement) =>
  (el.type === 'way' && el.tags?.disc_golf === 'hole') ||
  (el.type === 'node' && (el.tags?.disc_golf === 'tee' || el.tags?.disc_golf === 'basket'));

interface Candidate {
  el: OsmElement;
  center: LatLng;
  rings: Pt[][]; // outline ways (relation members are each a ring piece; even-odd works across pieces)
  area: number;
  parts: OsmElement[];
}

function candidate(el: OsmElement): Candidate | null {
  const b = el.bounds;
  const center = b ? ll({ lat: (b.minlat + b.maxlat) / 2, lon: (b.minlon + b.maxlon) / 2 }) : el.lat !== undefined ? ll(el as Pt) : null;
  if (!center) return null;
  const rings =
    el.type === 'way'
      ? [el.geometry ?? []].filter((r) => r.length > 3 && r[0].lat === r[r.length - 1].lat && r[0].lon === r[r.length - 1].lon)
      : (el.members ?? []).filter((m) => m.type === 'way' && m.role !== 'hole').map((m) => m.geometry ?? []);
  const area = b ? (b.maxlat - b.minlat) * (b.maxlon - b.minlon) : 0;
  return { el, center, rings, area, parts: [] };
}

/** Bounds check, then even-odd ray cast over every segment of every ring piece (closed ways repeat their first node). */
function inside(p: Pt, { el: { bounds: b }, rings }: Candidate): boolean {
  if (!b || p.lat < b.minlat || p.lat > b.maxlat || p.lon < b.minlon || p.lon > b.maxlon) return false;
  let odd = false;
  for (const r of rings)
    for (let i = 1, j = 0; i < r.length; j = i++)
      if (r[i].lat > p.lat !== r[j].lat > p.lat && p.lon < ((r[j].lon - r[i].lon) * (p.lat - r[i].lat)) / (r[j].lat - r[i].lat) + r[i].lon)
        odd = !odd;
  return odd;
}

function buildHoles(course: OsmElement, parts: OsmElement[]): Hole[] {
  const byNumber = new Map<number, Hole>();
  const hole = (n: number) => byNumber.get(n) ?? byNumber.set(n, { number: n, par: 3 }).get(n)!;
  // Ways first so their endpoints win over loose tee/basket nodes; ids for determinism.
  const sorted = [...parts].sort((a, b) => (a.type === b.type ? a.id - b.id : a.type === 'way' ? -1 : 1));
  for (const el of sorted) {
    const n = int(el.tags?.ref);
    if (!n) continue;
    const h = hole(n);
    if (el.type === 'way') {
      if (h.tee) continue; // duplicate ref: first way wins
      h.par = int(el.tags?.par) ?? h.par;
      const g = el.geometry;
      if (g && g.length >= 2) {
        h.tee = ll(g[0]);
        h.basket = ll(g[g.length - 1]);
      }
    } else if (el.tags?.disc_golf === 'tee') h.tee ??= ll(el as Pt);
    else h.basket ??= ll(el as Pt);
  }
  const holes = [...byNumber.values()].sort((a, b) => a.number - b.number);
  if (holes.length) return holes;
  const count = int(course.tags?.holes) ?? int(course.tags?.['disc_golf:holes']) ?? 18;
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par: 3 }));
}

function encodeHoles(holes: Hole[]): CourseRow[4] {
  if (holes.every((h, i) => h.number === i + 1 && h.par === 3 && !h.tee && !h.basket)) return holes.length;
  return holes.map((h) => {
    const row: HoleRow = [h.number, h.par];
    if (h.tee || h.basket) row.push(h.tee?.lat ?? null, h.tee?.lng ?? null);
    if (h.basket) row.push(h.basket.lat, h.basket.lng);
    return row;
  });
}

/** Pure: deduped Overpass `out geom` elements (any order) -> sorted compact dataset rows. */
export function buildDataset(elements: OsmElement[]): CourseRow[] {
  const byKey = new Map(elements.map((el) => [key(el), el]));
  const all = [...byKey.values()];
  const primary = all.filter(isPrimaryCourse).flatMap((el) => candidate(el) ?? []);
  const secondary = all
    .filter((el) => !isPrimaryCourse(el) && isSportCourse(el))
    .flatMap((el) => candidate(el) ?? [])
    .filter((s) => !primary.some((p) => haversine(p.center, s.center) < DUPLICATE_METERS || inside({ lat: p.center.lat, lon: p.center.lng }, s)));
  const courses = [...primary, ...secondary];

  const owner = new Map<string, Candidate>(); // explicit relation membership wins
  for (const c of courses) for (const m of c.el.members ?? []) owner.set(key(m), c);
  for (const el of all.filter(isHolePart)) {
    const at = el.type === 'way' ? el.geometry?.[0] : (el as Pt);
    if (!at) continue;
    const p = ll(at);
    let best = owner.get(key(el));
    if (!best) {
      const containing = courses.filter((c) => inside(at, c)).sort((a, b) => a.area - b.area);
      best = containing[0];
    }
    if (!best) {
      let bestM = ASSIGN_METERS;
      for (const c of courses) {
        if (Math.abs(c.center.lat - p.lat) > 0.01) continue; // ~1.1 km prefilter
        const m = haversine(c.center, p);
        if (m <= bestM) [best, bestM] = [c, m];
      }
    }
    best?.parts.push(el);
  }

  return courses
    .map((c): CourseRow => [key(c.el), c.el.tags?.name?.trim() ?? '', c.center.lat, c.center.lng, encodeHoles(buildHoles(c.el, c.parts))])
    .sort((a, b) => (a[0][0] === b[0][0] ? +a[0].slice(1) - +b[0].slice(1) : a[0] < b[0] ? -1 : 1));
}

const TYPES: Record<string, string> = { n: 'node', w: 'way', r: 'relation' };

export function decodeCourse([id, name, lat, lng, h]: CourseRow): Course {
  const pt = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? undefined : { lat: a, lng: b });
  const holes: Hole[] =
    typeof h === 'number'
      ? Array.from({ length: h }, (_, i) => ({ number: i + 1, par: 3 }))
      : h.map(([number, par, tLat, tLng, bLat, bLng]) => {
            const hole: Hole = { number: number!, par: par! };
            const tee = pt(tLat, tLng);
            const basket = pt(bLat, bLng);
            if (tee) hole.tee = tee;
            if (basket) hole.basket = basket;
            if (tee && basket) hole.lengthMeters = Math.round(haversine(tee, basket));
            return hole;
          });
  return { id: `osm:${TYPES[id[0]]}/${id.slice(1)}`, name: name || 'Unnamed course', location: { lat, lng }, holes, source: 'osm' };
}

/** "osm:way/123" -> its openstreetmap.org page. */
export const osmUrl = (courseId: string) => `https://www.openstreetmap.org/${courseId.slice(4)}`;
