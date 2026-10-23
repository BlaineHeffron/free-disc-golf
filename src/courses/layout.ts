import type { Course, Hole, LatLng } from '../types';

/**
 * On-device course layout format.
 *
 * Layouts are plain JSON files so they can be produced by any tool (an exporter, a
 * hand-written file) and imported into the app
 * without a server. The format is deliberately lossless about geometry and
 * tolerant when reading: unknown extra keys are ignored, so a richer exporter
 * stays forward-compatible.
 */
export const LAYOUT_FORMAT = 'dg-layout';
export const LAYOUT_VERSION = 1;

export interface LayoutHole {
  number: number; // 1-based
  par: number;
  lengthMeters?: number;
  tee?: LatLng;
  basket?: LatLng;
}

export interface CourseLayout {
  format: typeof LAYOUT_FORMAT;
  version: number;
  /** Stable id, e.g. "osm:way/123" or "manual:pier-park-back". */
  id: string;
  name: string;
  /** Named layout ("Blue tees", "Short pads") when the source distinguishes them. */
  layoutName?: string;
  location: LatLng;
  /** Where the holes came from — used for attribution + trust. */
  source: 'osm' | 'manual';
  capturedAt?: string; // ISO date the layout was recorded
  attribution?: string;
  holes: LayoutHole[];
}

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function asLatLng(value: unknown): LatLng | undefined {
  if (!isObject(value)) return undefined;
  // Accept {lat,lng}, {lat,lon}, {latitude,longitude}.
  const lat = value.lat ?? value.latitude;
  const lng = value.lng ?? value.lon ?? value.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

const positiveInt = (v: unknown): number | undefined => {
  // Exports often stringify numbers ("4"); coerce before validating.
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

function asHole(raw: unknown, index: number): LayoutHole {
  if (!isObject(raw)) throw new LayoutError(`hole ${index + 1}: expected an object`);
  const number = positiveInt(raw.number) ?? positiveInt(raw.hole) ?? positiveInt(raw.ref) ?? index + 1;
  const par = positiveInt(raw.par) ?? 3;
  if (par < 1 || par > 15) throw new LayoutError(`hole ${number}: par ${par} is out of range`);

  let lengthMeters =
    typeof raw.lengthMeters === 'number'
      ? Math.round(raw.lengthMeters)
      : typeof raw.length === 'number'
        ? Math.round(raw.length)
        : undefined;
  if (lengthMeters === undefined && typeof raw.lengthMeters === 'string') {
    const n = Number(raw.lengthMeters);
    if (Number.isFinite(n)) lengthMeters = Math.round(n);
  }
  if (lengthMeters !== undefined && (!Number.isFinite(lengthMeters) || lengthMeters < 0 || lengthMeters > 5000)) {
    throw new LayoutError(`hole ${number}: length ${lengthMeters} m is out of range`);
  }

  return { number, par, lengthMeters, tee: asLatLng(raw.tee), basket: asLatLng(raw.basket) };
}

function normalizeHoles(raw: unknown): LayoutHole[] {
  if (!Array.isArray(raw)) throw new LayoutError('"holes" must be an array');
  if (!raw.length) throw new LayoutError('layout has no holes');

  const holes = raw.map((h, i) => asHole(h, i)).sort((a, b) => a.number - b.number);
  const seen = new Set<number>();
  for (const h of holes) {
    if (seen.has(h.number)) throw new LayoutError(`duplicate hole number ${h.number}`);
    seen.add(h.number);
  }
  return holes;
}

/**
 * Validate and convert arbitrary JSON into a `CourseLayout`.
 *
 * Accepts the canonical `dg-layout` shape and the loose shapes an extraction
 * script tends to produce (`{ name, lat, lng, holes: [...] }`, a bare hole
 * array, etc.). Throws `LayoutError` with a human-readable message otherwise.
 */
export function parseLayout(input: unknown, fallback?: { name?: string; location?: LatLng }): CourseLayout {
  if (Array.isArray(input)) {
    input = { holes: input };
  }
  if (!isObject(input)) throw new LayoutError('layout must be a JSON object');

  // Some exporters wrap the payload in a single key.
  const wrapped = isObject(input.layout) ? input.layout : input;

  const holes = normalizeHoles(wrapped.holes ?? wrapped.layout ?? input.holes);
  const location =
    asLatLng(wrapped.location) ??
    asLatLng(wrapped) ??
    asLatLng(wrapped.center) ??
    asLatLng(wrapped.course) ??
    asLatLng(input) ??
    fallback?.location ??
    holes.find((h) => h.tee)?.tee ?? { lat: 0, lng: 0 };

  const name =
    (typeof wrapped.name === 'string' && wrapped.name.trim()) ||
    (typeof input.name === 'string' && input.name.trim()) ||
    fallback?.name ||
    'Imported course';

  const rawSource = typeof wrapped.source === 'string' ? wrapped.source : '';
  const source = rawSource === 'osm' ? rawSource : 'manual';

  const slug = input.id ?? wrapped.id;

  return {
    format: LAYOUT_FORMAT,
    version: typeof input.version === 'number' ? input.version : LAYOUT_VERSION,
    id: typeof slug === 'string' && slug ? slug : `manual:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    layoutName: typeof wrapped.layoutName === 'string' ? wrapped.layoutName : undefined,
    location,
    source,
    capturedAt: typeof input.capturedAt === 'string' ? input.capturedAt : undefined,
    attribution: typeof wrapped.attribution === 'string' ? wrapped.attribution : undefined,
    holes,
  };
}

/** Layout -> the scoring module's `Course`, recomputing lengths where both ends exist. */
export function layoutToCourse(layout: CourseLayout): Course {
  const holes: Hole[] = layout.holes.map((h) => {
    const hole: Hole = { number: h.number, par: h.par };
    if (h.tee) hole.tee = h.tee;
    if (h.basket) hole.basket = h.basket;
    if (h.lengthMeters !== undefined) hole.lengthMeters = h.lengthMeters;
    return hole;
  });
  const name = layout.layoutName ? `${layout.name} (${layout.layoutName})` : layout.name;
  return {
    id: layout.id,
    name,
    location: layout.location,
    holes,
    source: 'layout',
  };
}

/** `Course` -> a layout suitable for writing to disk. */
export function courseToLayout(course: Course, opts: { source?: CourseLayout['source'] } = {}): CourseLayout {
  return {
    format: LAYOUT_FORMAT,
    version: LAYOUT_VERSION,
    id: course.id,
    name: course.name,
    location: course.location,
    source: opts.source ?? 'manual',
    capturedAt: new Date().toISOString().slice(0, 10),
    holes: course.holes.map((h) => ({
      number: h.number,
      par: h.par,
      ...(h.lengthMeters !== undefined ? { lengthMeters: h.lengthMeters } : {}),
      ...(h.tee ? { tee: h.tee } : {}),
      ...(h.basket ? { basket: h.basket } : {}),
    })),
  };
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  // jsdom's File has no text(); fall back to FileReader.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsText(file);
  });
}

/** Read a `File` from an <input type="file"> into a course, without a network round-trip. */
export async function readLayoutFile(file: File): Promise<Course> {
  const text = await readFileText(file);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LayoutError(`${file.name} is not valid JSON`);
  }
  const fallbackName = file.name.replace(/\.json$/i, '');
  return layoutToCourse(parseLayout(json, { name: fallbackName }));
}
