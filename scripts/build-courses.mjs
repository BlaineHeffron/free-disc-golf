// Builds public/courses.json (worldwide disc golf courses + holes) from OpenStreetMap via Overpass.
// Usage: npm run build:courses   (COURSES_RAW=file caches the raw Overpass elements for re-runs)
// Data © OpenStreetMap contributors, ODbL 1.0. Format: see README "Course data".
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { buildDataset } from '../src/courses/osm.ts';

const OUT = new URL('../public/courses.json', import.meta.url);
const SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const UA = 'free-disc-golf-build/1.0 (+https://github.com/BlaineHeffron/free-disc-golf)';
const TILE = 30; // degrees; a tile too big for one query is split into quarters down to MIN_TILE
const MIN_TILE = 3.75;
const RETRIES = 8; // per tile, rotating servers
const PAUSE_MS = 5_000; // between requests
const BACKOFF_MS = 30_000; // after any failure (429/406/504/timeout), times the attempt number
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const query = ([s, w, n, e]) => {
  const b = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:180];(nwr["leisure"="disc_golf_course"]${b};nwr["sport"~"disc_golf"]${b};relation["type"="disc_golf_course"]${b};way["disc_golf"="hole"]${b};node["disc_golf"~"^(tee|basket)$"]${b};);out geom qt;`;
};

let turn = 0;
async function request(q) {
  const url = SERVERS[turn++ % SERVERS.length];
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': UA },
      body: new URLSearchParams({ data: q }),
      signal: AbortSignal.timeout(240_000),
    });
    const text = await res.text();
    if (!res.ok) return { error: `${url} HTTP ${res.status}`, tooBig: /timed out|out of memory/i.test(text) || Date.now() - t0 > 60_000 };
    const json = JSON.parse(text);
    // A remark means a runtime error and therefore a partial result.
    return json.remark ? { error: `${url} ${json.remark}`, tooBig: true } : { elements: json.elements };
  } catch (e) {
    return { error: `${url} ${e.message}`, tooBig: e.name === 'TimeoutError' };
  }
}

/** Busy servers (429/406/504) are retried with backoff; a tile that is too big for one query is split in four. */
async function tile(b) {
  const name = b.join(',');
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const { elements, error, tooBig } = await request(query(b));
    if (elements) {
      console.log(`tile ${name}: ${elements.length} elements`);
      await sleep(PAUSE_MS);
      return elements;
    }
    console.warn(`tile ${name} attempt ${attempt}/${RETRIES}: ${error}`);
    await sleep(BACKOFF_MS * Math.min(attempt, 4));
    if (tooBig && b[2] - b[0] > MIN_TILE) {
      const [s, w, n, e] = b;
      const [mLat, mLng] = [(s + n) / 2, (w + e) / 2];
      const out = [];
      for (const q of [[s, w, mLat, mLng], [s, mLng, mLat, e], [mLat, w, n, mLng], [mLat, mLng, n, e]]) out.push(...(await tile(q)));
      return out;
    }
  }
  throw new Error(`tile ${name} failed after ${RETRIES} attempts`);
}

async function fetchAll() {
  const raw = process.env.COURSES_RAW;
  if (raw && existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'));
  const elements = [];
  for (let s = -90; s < 90; s += TILE) for (let w = -180; w < 180; w += TILE) elements.push(...(await tile([s, w, s + TILE, w + TILE])));
  if (raw) writeFileSync(raw, JSON.stringify(elements));
  return elements;
}

try {
  const rows = buildDataset(await fetchAll());
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).courses.length : 0;
  if (rows.length < previous * 0.9) throw new Error(`only ${rows.length} courses (previously ${previous}); refusing to overwrite`);
  const body = `{"format":1,"license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","source":"https://www.openstreetmap.org/copyright","courses":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync(OUT, body);
  const detailed = rows.filter((r) => typeof r[4] !== 'number');
  const holes = detailed.reduce((n, r) => n + r[4].length, 0);
  const mapped = detailed.reduce((n, r) => n + (Array.isArray(r[4]) ? r[4].filter((h) => h.length === 6 && h[2] !== null).length : 0), 0);
  console.log(`courses ${rows.length}, with hole data ${detailed.length}, holes ${holes} (${mapped} with tee+basket)`);
  console.log(`bytes ${Buffer.byteLength(body)} raw, ${gzipSync(body).length} gzip`);
} catch (e) {
  console.error(`build-courses failed, ${OUT.pathname} left unchanged: ${e.message}`);
  process.exit(1);
}
