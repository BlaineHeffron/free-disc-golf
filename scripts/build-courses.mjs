// Builds public/courses.json (worldwide disc golf courses + holes) from OpenStreetMap via Overpass.
// Usage: npm run build:courses   (COURSES_RAW=file caches the raw Overpass elements for re-runs;
//        -- --extras-only merges data/extra-courses.json into the existing file, no download)
// Data © OpenStreetMap contributors, ODbL 1.0. Format: see README "Course data".
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { buildDataset, withExtras } from '../src/courses/osm.ts';

const OUT = new URL('../public/courses.json', import.meta.url);
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const UA = 'free-disc-golf-build/1.0 (+https://github.com/BlaineHeffron/free-disc-golf)';
// One request per tag, worldwide: Overpass answers rare-tag queries from its tag index far faster than
// bbox tiles (~40 s each). A query too big for the server is retried as four bbox quadrants, recursively.
const STATEMENTS = [
  'nwr["leisure"="disc_golf_course"]',
  'nwr["sport"~"disc_golf"]',
  'relation["type"="disc_golf_course"]',
  'way["disc_golf"="hole"]',
  'node["disc_golf"="tee"]',
  'node["disc_golf"="basket"]',
];
const MIN_TILE = 11.25; // degrees of latitude; smallest quadrant
const RETRIES = 8; // per request, rotating servers
const PAUSE_MS = 10_000; // between requests
const BACKOFF_MS = 30_000; // after any failure (429/406/504/timeout), times the attempt number (max 4x)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WORLD = [-90, -180, 90, 180];
const query = (stmt, b) => `[out:json][timeout:280];${stmt}${b === WORLD ? '' : `(${b.join(',')})`};out geom qt;`;

const MAX_AGE_MS = 2 * 86_400_000; // mirrors can lag or hold a partial database
async function request(q, attempt) {
  const url = SERVERS[(attempt - 1) % SERVERS.length]; // main server first, mirrors as fallback
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': UA },
      body: new URLSearchParams({ data: q }),
      signal: AbortSignal.timeout(330_000),
    });
    const text = await res.text();
    if (!res.ok) return { error: `${url} HTTP ${res.status}`, tooBig: /timed out|out of memory/i.test(text) };
    const json = JSON.parse(text);
    // A remark means a runtime error and therefore a partial result.
    if (json.remark) return { error: `${url} ${json.remark}`, tooBig: true };
    const base = json.osm3s?.timestamp_osm_base;
    if (!(Date.now() - Date.parse(base) < MAX_AGE_MS)) return { error: `${url} stale data (${base})` };
    return { elements: json.elements, source: `${url} @ ${base}` };
  } catch (e) {
    return { error: `${url} ${e.message}` };
  }
}

/** Busy servers (429/406/504, timeouts) are retried with backoff; an area too big for one query is split in four. */
async function tile(stmt, b = WORLD) {
  const name = `${stmt} ${b === WORLD ? 'world' : b.join(',')}`;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const { elements, error, tooBig, source } = await request(query(stmt, b), attempt);
    if (elements) {
      console.log(`${name}: ${elements.length} elements from ${source}`);
      await sleep(PAUSE_MS);
      return elements;
    }
    console.warn(`${name} attempt ${attempt}/${RETRIES}: ${error}`);
    await sleep(BACKOFF_MS * Math.min(attempt, 4));
    if (tooBig && b[2] - b[0] > MIN_TILE) {
      const [s, w, n, e] = b;
      const [mLat, mLng] = [(s + n) / 2, (w + e) / 2];
      const out = [];
      for (const q of [[s, w, mLat, mLng], [s, mLng, mLat, e], [mLat, w, n, mLng], [mLat, mLng, n, e]]) out.push(...(await tile(stmt, q)));
      return out;
    }
  }
  throw new Error(`${name} failed after ${RETRIES} attempts`);
}

async function fetchAll() {
  const raw = process.env.COURSES_RAW;
  if (raw && existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'));
  const elements = [];
  for (const stmt of STATEMENTS) elements.push(...(await tile(stmt)));
  if (raw) writeFileSync(raw, JSON.stringify(elements));
  return elements;
}

try {
  const extras = JSON.parse(readFileSync(new URL('../data/extra-courses.json', import.meta.url), 'utf8'));
  // --extras-only re-merges data/extra-courses.json into the existing file without querying Overpass.
  const base = process.argv.includes('--extras-only') ? JSON.parse(readFileSync(OUT, 'utf8')).courses : buildDataset(await fetchAll());
  const rows = withExtras(base, extras);
  // Weekly OSM changes are small; a big drop means a server returned incomplete data.
  const holeCount = (rs) => rs.reduce((n, r) => n + (typeof r[4] === 'number' ? 0 : r[4].length), 0);
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).courses : [];
  if (rows.length < prev.length * 0.95 || holeCount(rows) < holeCount(prev) * 0.95)
    throw new Error(`${rows.length} courses / ${holeCount(rows)} holes vs ${prev.length} / ${holeCount(prev)} before; refusing to overwrite`);
  const body = `{"format":1,"license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","source":"https://www.openstreetmap.org/copyright","courses":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync(OUT, body);
  const detailed = rows.filter((r) => typeof r[4] !== 'number');
  const holes = detailed.reduce((n, r) => n + r[4].length, 0);
  const mapped = detailed.reduce((n, r) => n + r[4].filter((h) => h.length === 6 && h[2] !== null).length, 0);
  console.log(`courses ${rows.length}, with hole data ${detailed.length}, holes ${holes} (${mapped} with tee+basket)`);
  console.log(`bytes ${Buffer.byteLength(body)} raw, ${gzipSync(body).length} gzip`);
} catch (e) {
  console.error(`build-courses failed, ${OUT.pathname} left unchanged: ${e.message}`);
  process.exit(1);
}
